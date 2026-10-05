from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.weekly_fields import COUNT_FIELDS, MEASURE_FIELDS, SCORE_FIELDS
from app.db.base import Base
from app.models.school import Identity, Tenant, Timestamps


class WeeklyRecord(Identity, Tenant, Timestamps, Base):
    __tablename__ = "weekly_records"
    __table_args__ = (
        UniqueConstraint("student_id", "course_offering_id", "week_start"),
        ForeignKeyConstraint(
            ["school_id", "student_id", "course_offering_id"],
            ["enrollments.school_id", "enrollments.student_id", "enrollments.course_offering_id"],
        ),
        ForeignKeyConstraint(["school_id", "created_by"], ["users.school_id", "users.id"]),
        *[
            CheckConstraint(f"{name} BETWEEN 0 AND 1000000", name=f"{name}_range")
            for name in COUNT_FIELDS
        ],
        *[
            CheckConstraint(f"{name} BETWEEN 0 AND 100", name=f"{name}_range")
            for name in SCORE_FIELDS
        ],
        *[
            CheckConstraint(f"{name} BETWEEN 0 AND 1000000", name=f"{name}_range")
            for name in MEASURE_FIELDS
        ],
        CheckConstraint("classes_attended <= classes_held", name="attendance_counts"),
        CheckConstraint("late_submissions <= assignment_count", name="late_counts"),
        CheckConstraint("assignments_completed <= assignment_count", name="completed_counts"),
        CheckConstraint("late_submissions <= assignments_completed", name="late_completed_counts"),
        CheckConstraint("last_minute_submissions <= assignment_count", name="last_minute_counts"),
        CheckConstraint(
            "participation_count <= participation_opportunities", name="participation_counts"
        ),
        CheckConstraint("lms_active_days <= 7", name="active_days"),
        CheckConstraint("study_hours_weekly <= 168", name="study_hours"),
        CheckConstraint("student_confidence_score BETWEEN 1 AND 5", name="confidence"),
        CheckConstraint("extract(isodow from week_start) = 1", name="monday_week_start"),
        CheckConstraint(
            "source IN ('manual', 'csv_import', 'lms_sync', 'sis_sync')", name="source"
        ),
        Index(
            "ix_weekly_records_school_student_course_week",
            "school_id",
            "student_id",
            "course_offering_id",
            "week_start",
        ),
    )
    student_id: Mapped[UUID]
    course_offering_id: Mapped[UUID]
    week_start: Mapped[date]
    classes_held: Mapped[int | None]
    classes_attended: Mapped[int | None]
    study_hours_weekly: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    assessment_avg_score: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    assessment_count: Mapped[int | None]
    assignment_count: Mapped[int | None]
    assignments_completed: Mapped[int | None]
    late_submissions: Mapped[int | None]
    last_minute_submissions: Mapped[int | None]
    avg_submission_delay_days: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    assignment_avg_score: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    quiz_count: Mapped[int | None]
    quiz_attempt_count: Mapped[int | None]
    quiz_avg_score: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    lms_login_count: Mapped[int | None]
    lms_active_days: Mapped[int | None]
    avg_lms_session_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    total_lms_time_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    days_since_last_login: Mapped[int | None]
    participation_count: Mapped[int | None]
    participation_opportunities: Mapped[int | None]
    student_confidence_score: Mapped[int | None]
    student_checkin_text: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual", server_default="manual")
    created_by: Mapped[UUID]
