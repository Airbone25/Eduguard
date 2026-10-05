from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from app.api.v1.auth import router
from app.core.exceptions import APIError, install_error_handlers
from app.core.security import decode_token
from app.db.seed import DEMO_PASSWORD
from app.db.session import get_db
from app.models import RefreshToken
from app.schemas.auth import LoginRequest
from app.services.auth_service import login, refresh


def test_auth_across_independent_request_transactions(pg_engine):
    """Exercise real commits and fresh sessions, including transaction-pooler schema state."""
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    install_error_handlers(app)

    def session_dependency():
        with Session(pg_engine) as db:
            assert db.scalar(text("SELECT current_schema()")).startswith("eduguard_test_")
            yield db

    app.dependency_overrides[get_db] = session_dependency
    session_id = None
    try:
        with TestClient(app) as client:
            result = client.post(
                "/api/v1/auth/login",
                json={
                    "school_slug": "demo",
                    "email": "teacher@demo.edu",
                    "password": DEMO_PASSWORD,
                },
            )
            assert result.status_code == 200
            tokens = result.json()
            session_id = UUID(decode_token(tokens["access_token"], "access")["sid"])
            auth = {"Authorization": f"Bearer {tokens['access_token']}"}
            assert client.get("/api/v1/auth/me", headers=auth).status_code == 200
            rotated = client.post(
                "/api/v1/auth/refresh",
                json={
                    "refresh_token": tokens["refresh_token"],
                },
            )
            assert rotated.status_code == 200
            assert (
                client.post(
                    "/api/v1/auth/logout",
                    json={
                        "refresh_token": rotated.json()["refresh_token"],
                    },
                ).status_code
                == 204
            )
            assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    finally:
        if session_id:
            with pg_engine.begin() as connection:
                connection.execute(delete(RefreshToken).where(RefreshToken.id == session_id))


def test_concurrent_refresh_has_one_winner(pg_engine):
    with Session(pg_engine) as db:
        tokens = login(
            db, LoginRequest(school_slug="demo", email="teacher@demo.edu", password=DEMO_PASSWORD)
        )
    session_id = UUID(decode_token(tokens.access_token, "access")["sid"])
    barrier = Barrier(2)

    def rotate():
        with Session(pg_engine) as db:
            barrier.wait(timeout=30)
            try:
                refresh(db, tokens.refresh_token)
                return 200
            except APIError as exc:
                return exc.status_code

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: rotate(), range(2)))
        assert sorted(results) == [200, 401]
    finally:
        with pg_engine.begin() as connection:
            connection.execute(delete(RefreshToken).where(RefreshToken.id == session_id))
