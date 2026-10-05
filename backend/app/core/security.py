import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.models.school import User

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    try:
        return password_hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def encode_token(user: User, session_id: UUID, token_type: str, expires: datetime) -> str:
    settings = get_settings()
    return jwt.encode(
        {
            "sub": str(user.id),
            "school_id": str(user.school_id),
            "role": user.role.value,
            "sid": str(session_id),
            "jti": str(uuid4()),
            "type": token_type,
            "iat": datetime.now(UTC),
            "exp": expires,
            "iss": "eduguard",
            "aud": "eduguard-api",
        },
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def access_token(user: User, session_id: UUID) -> str:
    return encode_token(
        user,
        session_id,
        "access",
        datetime.now(UTC) + timedelta(minutes=get_settings().access_token_minutes),
    )


def decode_token(token: str, expected_type: str) -> dict:
    settings = get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            issuer="eduguard",
            audience="eduguard-api",
            options={"require": ["sub", "school_id", "role", "sid", "jti", "type", "iat", "exp"]},
        )
        if claims["type"] != expected_type:
            raise ValueError("Wrong token type")
        for name in ("sub", "school_id", "sid", "jti"):
            UUID(claims[name])
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, AttributeError) as exc:
        raise APIError(401, "INVALID_TOKEN", "Invalid or expired token.") from exc
