from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

from app.core.enums import Role


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictInput):
    school_slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=1024)


class RefreshRequest(StrictInput):
    refresh_token: SecretStr = Field(min_length=1, max_length=4096)


class ChangePasswordRequest(StrictInput):
    current_password: SecretStr = Field(min_length=1, max_length=1024)
    new_password: SecretStr = Field(min_length=12, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    school_id: UUID
    email: EmailStr
    role: Role
    first_name: str
    last_name: str
    is_active: bool
    last_login_at: datetime | None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse
