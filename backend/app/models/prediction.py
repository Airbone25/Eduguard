from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.school import Identity, Tenant, Timestamps


class ModelVersion(Identity, Base):
    __tablename__ = "model_versions"
    __table_args__ = (
        UniqueConstraint("name", "version"),
        Index(
            "uq_model_versions_active", "is_active", unique=True, postgresql_where=text("is_active")
        ),
    )
    name: Mapped[str] = mapped_column(String(200))
    version: Mapped[str] = mapped_column(String(100))
    artifact_path: Mapped[str] = mapped_column(String(500))
    artifact_sha256: Mapped[str] = mapped_column(String(64))
    feature_version: Mapped[str] = mapped_column(String(100))
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict)
    thresholds: Mapped[dict] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(default=True)
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FeatureSnapshot(Identity, Tenant, Base):
    __tablename__ = "feature_snapshots"
    __table_args__ = (
        UniqueConstraint("school_id", "id", "student_id", "course_offering_id"),
        ForeignKeyConstraint(
            ["school_id", "student_id"], ["student_profiles.school_id", "student_profiles.id"]
        ),
        ForeignKeyConstraint(
            ["school_id", "course_offering_id"],
            ["course_offerings.school_id", "course_offerings.id"],
        ),
    )
    student_id: Mapped[UUID]
    course_offering_id: Mapped[UUID | None]
    as_of_date: Mapped[date]
    feature_version: Mapped[str] = mapped_column(String(100))
    features: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RiskPrediction(Identity, Tenant, Base):
    __tablename__ = "risk_predictions"
    __table_args__ = (
        # Lets interventions reference a prediction by tenant + student + course.
        UniqueConstraint("school_id", "id", "student_id", "course_offering_id"),
        ForeignKeyConstraint(
            ["school_id", "student_id"], ["student_profiles.school_id", "student_profiles.id"]
        ),
        ForeignKeyConstraint(
            ["school_id", "course_offering_id"],
            ["course_offerings.school_id", "course_offerings.id"],
        ),
        ForeignKeyConstraint(
            ["school_id", "feature_snapshot_id", "student_id", "course_offering_id"],
            [
                "feature_snapshots.school_id",
                "feature_snapshots.id",
                "feature_snapshots.student_id",
                "feature_snapshots.course_offering_id",
            ],
        ),
        ForeignKeyConstraint(["school_id", "created_by"], ["users.school_id", "users.id"]),
        CheckConstraint("risk_probability BETWEEN 0 AND 1", name="probability"),
        CheckConstraint("risk_level IN ('low', 'medium', 'high')", name="risk_level"),
        Index(
            "ix_risk_predictions_school_student_course_created",
            "school_id",
            "student_id",
            "course_offering_id",
            "created_at",
        ),
    )
    student_id: Mapped[UUID]
    course_offering_id: Mapped[UUID | None]
    feature_snapshot_id: Mapped[UUID]
    model_version_id: Mapped[UUID] = mapped_column(ForeignKey("model_versions.id"))
    risk_probability: Mapped[Decimal] = mapped_column(Numeric(12, 10))
    risk_level: Mapped[str] = mapped_column(String(20))
    at_risk: Mapped[bool]
    explanations: Mapped[list] = mapped_column(JSONB)
    recommendations: Mapped[list] = mapped_column(JSONB)
    created_by: Mapped[UUID | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InterventionTemplate(Identity, Timestamps, Base):
    __tablename__ = "intervention_templates"
    __table_args__ = (
        UniqueConstraint("school_id", "name"),
        Index(
            "uq_intervention_templates_default_name",
            "name",
            unique=True,
            postgresql_where=text("school_id IS NULL"),
        ),
    )
    school_id: Mapped[UUID | None] = mapped_column(ForeignKey("schools.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    tags: Mapped[dict] = mapped_column(JSONB)
    default_duration_days: Mapped[int | None]
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
