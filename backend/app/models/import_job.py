from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKeyConstraint, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.school import Identity, Tenant


class ImportJob(Identity, Tenant, Base):
    __tablename__ = "import_jobs"
    __table_args__ = (
        ForeignKeyConstraint(["school_id", "uploaded_by"], ["users.school_id", "users.id"]),
        CheckConstraint("import_type IN ('students', 'weekly_records')", name="import_type"),
        CheckConstraint(
            "status IN ('processing', 'validated', 'validation_failed', 'succeeded', 'failed')",
            name="status",
        ),
        CheckConstraint(
            "rows_total >= 0 AND rows_succeeded >= 0 AND rows_failed >= 0",
            name="nonnegative_counts",
        ),
        CheckConstraint("rows_succeeded + rows_failed <= rows_total", name="bounded_counts"),
        Index("ix_import_jobs_school_created", "school_id", "created_at"),
    )
    uploaded_by: Mapped[UUID]
    filename: Mapped[str] = mapped_column(String(200))
    import_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    rows_total: Mapped[int]
    rows_succeeded: Mapped[int] = mapped_column(default=0)
    rows_failed: Mapped[int] = mapped_column(default=0)
    errors: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
