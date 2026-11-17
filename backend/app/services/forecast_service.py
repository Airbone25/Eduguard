from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.ml.feature_builder import build_features
from app.ml.forecast import (
    BAND_LEVEL,
    FORECAST_HORIZON_WEEKS,
    METHOD,
    MIN_FORECAST_WEEKS,
    forecast_paths,
)
from app.ml.model_loader import LoadedModel
from app.models import (
    CourseOffering,
    FeatureSnapshot,
    RiskPrediction,
    Subject,
    User,
    WeeklyRecord,
)
from app.schemas.prediction import ForecastResponse
from app.services.common import tenant_row
from app.services.feature_service import student_history_rows
from app.services.weekly_record_service import authorized_enrollment


def _forecast_anchor(db: Session, teacher: User, student_id: UUID, course_id: UUID) -> date:
    """The projection continues from the latest insight week for the course,
    so the cone attaches to the trajectory the teacher is already reading."""
    latest = db.scalar(
        select(FeatureSnapshot.as_of_date)
        .join(RiskPrediction, RiskPrediction.feature_snapshot_id == FeatureSnapshot.id)
        .where(
            RiskPrediction.school_id == teacher.school_id,
            RiskPrediction.student_id == student_id,
            RiskPrediction.course_offering_id == course_id,
        )
        .order_by(FeatureSnapshot.as_of_date.desc(), RiskPrediction.created_at.desc())
        .limit(1)
    )
    if latest is None:
        latest = db.scalar(
            select(WeeklyRecord.week_start)
            .where(
                WeeklyRecord.school_id == teacher.school_id,
                WeeklyRecord.student_id == student_id,
                WeeklyRecord.course_offering_id == course_id,
            )
            .order_by(WeeklyRecord.week_start.desc())
            .limit(1)
        )
        if latest is None:
            raise APIError(
                422,
                "FORECAST_INSUFFICIENT_HISTORY",
                "No recorded weeks exist for this student and course.",
            )
    return latest - timedelta(days=latest.weekday())


def student_forecast(
    db: Session,
    teacher: User,
    student_id: UUID,
    course_id: UUID,
    model: LoadedModel,
) -> ForecastResponse:
    authorized_enrollment(db, teacher, student_id, course_id)
    course = tenant_row(db, CourseOffering, teacher.school_id, course_id)
    subject = tenant_row(db, Subject, teacher.school_id, course.subject_id)
    anchor = _forecast_anchor(db, teacher, student_id, course_id)
    rows = student_history_rows(db, teacher, student_id, course_id, anchor)
    history_weeks = build_features(rows, anchor).metadata["history_weeks_available"]
    if history_weeks < MIN_FORECAST_WEEKS:
        raise APIError(
            422,
            "FORECAST_INSUFFICIENT_HISTORY",
            f"At least {MIN_FORECAST_WEEKS} recorded weeks are required for a projection.",
        )
    try:
        points = forecast_paths(model, subject.code, subject.name, rows, anchor)
    except (ValueError, TypeError) as exc:
        raise APIError(
            503,
            "FORECAST_FAILED",
            "The active model could not produce a projection from these observations.",
        ) from exc
    return ForecastResponse(
        student_id=student_id,
        course_offering_id=course_id,
        as_of_date=anchor,
        history_weeks=history_weeks,
        horizon_weeks=FORECAST_HORIZON_WEEKS,
        band_level=BAND_LEVEL,
        model_version=model.metadata["model_version"],
        method=METHOD,
        points=points,
    )
