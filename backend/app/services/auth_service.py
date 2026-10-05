import hmac
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.core.security import (
    access_token,
    decode_token,
    encode_token,
    hash_password,
    password_hasher,
    token_digest,
    verify_password,
)
from app.models import RefreshToken, School, User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserResponse

_DUMMY_HASH = hash_password("timing-only-placeholder-not-an-account")


def active_user(db: Session, claims: dict, *, lock: bool = False) -> User:
    query = (
        select(User)
        .join(School)
        .where(
            User.id == UUID(claims["sub"]),
            User.school_id == UUID(claims["school_id"]),
            User.is_active.is_(True),
            School.is_active.is_(True),
        )
    )
    if lock:
        query = query.with_for_update(of=User)
    user = db.scalar(query.execution_options(populate_existing=True))
    if user is None or user.role.value != claims["role"]:
        raise APIError(401, "INVALID_TOKEN", "Invalid or expired token.")
    return user


def active_session(db: Session, user: User, claims: dict, *, lock: bool = False) -> RefreshToken:
    query = select(RefreshToken).where(
        RefreshToken.id == UUID(claims["sid"]),
        RefreshToken.user_id == user.id,
        RefreshToken.school_id == user.school_id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.now(UTC),
    )
    if lock:
        query = query.with_for_update()
    session = db.scalar(query.execution_options(populate_existing=True))
    if session is None:
        raise APIError(401, "INVALID_TOKEN", "Invalid or expired token.")
    return session


def token_pair(user: User, session: RefreshToken) -> TokenResponse:
    refresh = encode_token(user, session.id, "refresh", session.expires_at)
    session.token_hash = token_digest(refresh)
    return TokenResponse(
        access_token=access_token(user, session.id),
        refresh_token=refresh,
        user=UserResponse.model_validate(user),
    )


def login(db: Session, data: LoginRequest) -> TokenResponse:
    # Lock the user before sessions everywhere, including refresh/password changes.
    user = db.scalar(
        select(User)
        .join(School)
        .where(
            School.slug == data.school_slug,
            School.is_active.is_(True),
            User.email == str(data.email),
        )
        .with_for_update(of=User)
    )
    valid = verify_password(
        data.password.get_secret_value(), user.password_hash if user else _DUMMY_HASH
    )
    if not valid or user is None or not user.is_active:
        raise APIError(401, "INVALID_CREDENTIALS", "Invalid school, email, or password.")
    if password_hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password.get_secret_value())
    user.last_login_at = datetime.now(UTC)
    session = RefreshToken(
        id=uuid4(),
        school_id=user.school_id,
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=get_settings().refresh_token_days),
    )
    result = token_pair(user, session)
    db.add(session)
    db.commit()
    return result


def refresh(db: Session, token: str) -> TokenResponse:
    claims = decode_token(token, "refresh")
    user = active_user(db, claims, lock=True)
    session = active_session(db, user, claims, lock=True)
    if not hmac.compare_digest(session.token_hash, token_digest(token)):
        raise APIError(401, "INVALID_TOKEN", "Invalid or expired token.")
    result = token_pair(user, session)
    db.commit()
    return result


def logout(db: Session, token: str) -> None:
    claims = decode_token(token, "refresh")
    user = active_user(db, claims, lock=True)
    session = active_session(db, user, claims, lock=True)
    if not hmac.compare_digest(session.token_hash, token_digest(token)):
        raise APIError(401, "INVALID_TOKEN", "Invalid or expired token.")
    session.revoked_at = datetime.now(UTC)
    db.commit()


def change_password(db: Session, user: User, data: ChangePasswordRequest) -> None:
    user = db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not verify_password(data.current_password.get_secret_value(), user.password_hash):
        raise APIError(400, "INCORRECT_PASSWORD", "Current password is incorrect.")
    if data.current_password.get_secret_value() == data.new_password.get_secret_value():
        raise APIError(400, "PASSWORD_UNCHANGED", "Choose a different password.")
    user.password_hash = hash_password(data.new_password.get_secret_value())
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user.id,
            RefreshToken.school_id == user.school_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    db.commit()
