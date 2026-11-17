from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.feature_builder import FeatureResult, build_features
from app.ml.feature_definitions import WINDOW_WEEKS
from app.models import User, WeeklyRecord
from app.schemas.weekly_record import WeeklyData
from app.services.weekly_record_service import authorized_enrollment


def student_history_rows(
    db: Session, teacher: User, student_id: UUID, course_id: UUID, as_of_date: date
) -> list[dict]:
    authorized_enrollment(db, teacher, student_id, course_id)
    anchor = as_of_date - timedelta(days=as_of_date.weekday())
    rows = db.scalars(
        select(WeeklyRecord)
        .where(
            WeeklyRecord.school_id == teacher.school_id,
            WeeklyRecord.student_id == student_id,
            WeeklyRecord.course_offering_id == course_id,
            WeeklyRecord.week_start <= as_of_date,
            WeeklyRecord.week_start >= anchor - timedelta(weeks=WINDOW_WEEKS - 1),
        )
        .order_by(WeeklyRecord.week_start)
    ).all()
    # Explicit whitelist excludes identity, free text and target-derived fields.
    numeric = set(WeeklyData.model_fields) - {"student_checkin_text"}
    return [
        {"week_start": row.week_start, **{key: getattr(row, key) for key in numeric}}
        for row in rows
    ]


def build_student_features(
    db: Session, teacher: User, student_id: UUID, course_id: UUID, as_of_date: date
) -> FeatureResult:
    return build_features(
        student_history_rows(db, teacher, student_id, course_id, as_of_date),
        as_of_date,
    )
