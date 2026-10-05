from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    response.headers["Cache-Control"] = "no-store"
    return auth_service.login(db, data)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    data: RefreshRequest, response: Response, db: Session = Depends(get_db)
) -> TokenResponse:
    response.headers["Cache-Control"] = "no-store"
    return auth_service.refresh(db, data.refresh_token.get_secret_value())


@router.post("/logout", status_code=204)
def logout(data: RefreshRequest, db: Session = Depends(get_db)) -> None:
    auth_service.logout(db, data.refresh_token.get_secret_value())


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.post("/change-password", status_code=204)
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    auth_service.change_password(db, user, data)
