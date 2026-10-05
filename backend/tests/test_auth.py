from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.enums import Role
from app.core.security import decode_token, encode_token, token_digest, verify_password
from app.db.seed import DEMO_PASSWORD
from app.models import RefreshToken, School, User


def login(client, email="teacher@demo.edu", password=DEMO_PASSWORD, school_slug="demo"):
    return client.post(
        "/api/v1/auth/login",
        json={
            "school_slug": school_slug,
            "email": email,
            "password": password,
        },
    )


def headers(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_login_me_and_secret_storage(client, db):
    response = login(client)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    tokens = response.json()
    assert tokens["token_type"] == "bearer"
    user = db.scalar(select(User).where(User.email == "teacher@demo.edu"))
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password(DEMO_PASSWORD, user.password_hash)
    session = db.scalar(select(RefreshToken))
    assert session.token_hash == token_digest(tokens["refresh_token"])
    assert session.token_hash != tokens["refresh_token"]
    claims = decode_token(tokens["access_token"], "access")
    assert claims["school_id"] == str(user.school_id)
    assert claims["role"] == "teacher"
    me = client.get("/api/v1/auth/me", headers=headers(tokens))
    assert me.status_code == 200
    assert me.json()["email"] == "teacher@demo.edu"
    assert "password_hash" not in me.text
    assert "refresh_token" not in me.text


@pytest.mark.parametrize(
    "field,value",
    [
        ("password", "wrong"),
        ("email", "missing@demo.edu"),
        ("school_slug", "missing"),
    ],
)
def test_bad_credentials(client, field, value):
    response = login(client, **{field: value})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.parametrize("model", [User, School])
def test_inactive_identity_denies_login_and_existing_tokens(client, db, model):
    tokens = login(client).json()
    query = select(model)
    if model is User:
        query = query.where(User.email == "teacher@demo.edu")
    db.scalar(query).is_active = False
    db.flush()
    assert login(client).status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers(tokens)).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": tokens["refresh_token"],
            },
        ).status_code
        == 401
    )


def test_rotation_logout_and_revocation(client):
    original = login(client).json()
    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": original["refresh_token"],
        },
    )
    assert response.status_code == 200
    rotated = response.json()
    assert rotated["refresh_token"] != original["refresh_token"]
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": original["refresh_token"],
            },
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/logout",
            json={
                "refresh_token": rotated["refresh_token"],
            },
        ).status_code
        == 204
    )
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": rotated["refresh_token"],
            },
        ).status_code
        == 401
    )
    assert client.get("/api/v1/auth/me", headers=headers(rotated)).status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers(original)).status_code == 401


def test_invalid_expired_and_wrong_type_tokens(client, db):
    tokens = login(client).json()
    user = db.scalar(select(User).where(User.email == "teacher@demo.edu"))
    expired = encode_token(user, uuid4(), "access", datetime.now(UTC) - timedelta(minutes=1))
    for token in ["invalid", expired, tokens["refresh_token"]]:
        assert (
            client.get(
                "/api/v1/auth/me",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            ).status_code
            == 401
        )
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": tokens["access_token"],
            },
        ).status_code
        == 401
    )


def test_expired_refresh_session(client, db):
    tokens = login(client).json()
    db.scalar(select(RefreshToken)).expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.flush()
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": tokens["refresh_token"],
            },
        ).status_code
        == 401
    )


def test_password_change_revokes_all_sessions(client):
    first, second = login(client).json(), login(client).json()
    changed = client.post(
        "/api/v1/auth/change-password",
        headers=headers(first),
        json={
            "current_password": DEMO_PASSWORD,
            "new_password": "Changed-Password-2026!",
        },
    )
    assert changed.status_code == 204
    assert login(client).status_code == 401
    assert login(client, password="Changed-Password-2026!").status_code == 200
    for tokens in (first, second):
        assert client.get("/api/v1/auth/me", headers=headers(tokens)).status_code == 401
        assert (
            client.post(
                "/api/v1/auth/refresh",
                json={
                    "refresh_token": tokens["refresh_token"],
                },
            ).status_code
            == 401
        )


def test_wrong_current_password_and_validation_do_not_leak(client):
    tokens = login(client).json()
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers(tokens),
        json={
            "current_password": "wrong",
            "new_password": "Changed-Password-2026!",
        },
    )
    assert response.status_code == 400
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers(tokens),
        json={
            "current_password": DEMO_PASSWORD,
            "new_password": "TinyPwd-9!",
        },
    )
    assert response.status_code == 422
    assert DEMO_PASSWORD not in response.text and "TinyPwd-9!" not in response.text
    assert login(client).status_code == 200


def test_role_and_school_cannot_be_overridden(client, db):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "school_slug": "demo",
            "email": "teacher@demo.edu",
            "password": DEMO_PASSWORD,
            "role": "school_admin",
            "school_id": str(uuid4()),
        },
    )
    assert response.status_code == 422
    tokens = login(client).json()
    claims = decode_token(tokens["access_token"], "access")
    for field, value in [
        ("role", "school_admin"),
        ("school_id", str(uuid4())),
        ("sub", "bad-uuid"),
    ]:
        altered = jwt.encode(
            {**claims, field: value},
            get_settings().jwt_secret.get_secret_value(),
            algorithm="HS256",
        )
        assert (
            client.get(
                "/api/v1/auth/me",
                headers={
                    "Authorization": f"Bearer {altered}",
                },
            ).status_code
            == 401
        )
    db.scalar(select(User).where(User.email == "teacher@demo.edu")).role = Role.SCHOOL_ADMIN
    db.flush()
    assert client.get("/api/v1/auth/me", headers=headers(tokens)).status_code == 401


def test_login_case_insensitive_and_all_roles(client):
    for email, role in [
        ("ADMIN@demo.edu", "school_admin"),
        ("student@demo.edu", "student"),
        ("TEACHER@demo.edu", "teacher"),
    ]:
        response = login(client, email=email)
        assert response.status_code == 200
        assert response.json()["user"]["role"] == role
