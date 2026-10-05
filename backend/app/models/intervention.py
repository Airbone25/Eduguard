from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import InterventionStatus, InterventionUpdateKind
from app.db.base import Base
from app.models.school import Identity, Tenant, Timestamps, enum_type

OPEN_STATUSES = (InterventionStatus.PLANNED, InterventionStatus.ACTIVE)


class Intervention(Identity, Tenant, Timestamps, Base):
    __tablename__ = "interventions"
    __table_args__ = (
        UniqueConstraint("school_id", "id"),
        ForeignKeyConstraint(
            ["school_id", "student_id"], ["student_profiles.school_id", "student_profiles.id"]
        ),
        ForeignKeyConstraint(
            ["school_id", "course_offering_id"],
            ["course_offerings.school_id", "course_offerings.id"],
        ),
        ForeignKeyConstraint(
            ["school_id", "prediction_id", "student_id", "course_offering_id"],
            [
                "risk_predictions.school_id",
                "risk_predictions.id",
                "risk_predictions.student_id",
                "risk_predictions.course_offering_id",
            ],
        ),
        ForeignKeyConstraint(["school_id", "created_by"], ["users.school_id", "users.id"]),
        CheckConstraint("status IN ('planned', 'active', 'completed', 'cancelled')", name="status"),
        CheckConstraint("review_date IS NULL OR review_date >= start_date", name="review_window"),
        CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)", name="completion_consistency"
        ),
        Index(
            "ix_interventions_school_student_course_created",
            "school_id",
            "student_id",
            "course_offering_id",
            "created_at",
        ),
        Index("ix_interventions_school_student_status", "school_id", "student_id", "status"),
    )
    student_id: Mapped[UUID]
    course_offering_id: Mapped[UUID]
    template_id: Mapped[UUID | None] = mapped_column(ForeignKey("intervention_templates.id"))
    prediction_id: Mapped[UUID | None]
    title: Mapped[str] = mapped_column(String(200))
    frequency: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[InterventionStatus] = mapped_column(
        enum_type(InterventionStatus, "intervention_status"),
        default=InterventionStatus.PLANNED,
        server_default="planned",
    )
    start_date: Mapped[date]
    review_date: Mapped[date | None]
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    visibility_to_student: Mapped[bool] = mapped_column(default=False, server_default="false")
    goal_definition: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[UUID]


class InterventionUpdate(Identity, Tenant, Base):
    __tablename__ = "intervention_updates"
    __table_args__ = (
        ForeignKeyConstraint(
            ["school_id", "intervention_id"], ["interventions.school_id", "interventions.id"]
        ),
        ForeignKeyConstraint(["school_id", "author_user_id"], ["users.school_id", "users.id"]),
        CheckConstraint(
            "kind IN ('created', 'note', 'status_change', 'completed')", name="update_kind"
        ),
        # Several updates can share one transaction timestamp, so order by sequence.
        CheckConstraint("sequence >= 1", name="sequence_positive"),
        UniqueConstraint("intervention_id", "sequence"),
        Index(
            "ix_intervention_updates_school_intervention_created",
            "school_id",
            "intervention_id",
            "created_at",
        ),
    )
    intervention_id: Mapped[UUID]
    author_user_id: Mapped[UUID]
    sequence: Mapped[int]
    kind: Mapped[InterventionUpdateKind] = mapped_column(
        enum_type(InterventionUpdateKind, "intervention_update_kind")
    )
    note: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
