from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKeyConstraint, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.school import Identity, Tenant


class AuditLog(Identity, Tenant, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        ForeignKeyConstraint(["school_id", "actor_user_id"], ["users.school_id", "users.id"]),
    )
    actor_user_id: Mapped[UUID | None]
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[UUID | None]
    details: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
