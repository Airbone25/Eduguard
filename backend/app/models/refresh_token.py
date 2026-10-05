from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKeyConstraint, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.school import Identity, Tenant


class RefreshToken(Identity, Tenant, Base):
    """One login session; rotation atomically replaces its refresh token digest."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        ForeignKeyConstraint(["school_id", "user_id"], ["users.school_id", "users.id"]),
    )
    user_id: Mapped[UUID] = mapped_column(index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
