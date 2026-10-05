from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import EnrollmentStatus, Role
from app.core.exceptions import APIError
from app.core.permissions import teacher_has_course_access
from app.models import (
    CourseOffering,
    Enrollment,
    FeatureSnapshot,
    Intervention,
    RiskPrediction,
    StudentProfile,
    User,
    WeeklyRecord,
)
from app.models.intervention import OPEN_STATUSES
from app.schemas.dashboard import DashboardCounts, DashboardSort, DashboardStudent, RiskSummary
from app.schemas.school import CourseResponse
from app.services.common import tenant_row
from app.services.progress_metrics import history_features, trajectory, week_anchor

SUPPORT = {"high": "priority_support", "medium": "watch", "low": "doing_well"}


def risk_summary(
    db: Session,
    teacher: User,
    course_id: UUID,
    as_of_date: date,
    sort: DashboardSort,
    limit: int,
    offset: int,
) -> RiskSummary:
    if not teacher_has_course_access(db, teacher, course_id):
        raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
    course = tenant_row(db, CourseOffering, teacher.school_id, course_id)
    roster = db.execute(
        select(StudentProfile, User)
        .join(User, User.id == StudentProfile.user_id)
        .join(Enrollment, Enrollment.student_id == StudentProfile.id)
        .where(
            StudentProfile.school_id == teacher.school_id,
            User.school_id == teacher.school_id,
            Enrollment.school_id == teacher.school_id,
            Enrollment.course_offering_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
            Enrollment.enrolled_at <= min(as_of_date, datetime.now(UTC).date()),
            User.is_active.is_(True),
            User.role == Role.STUDENT,
        )
    ).all()
    ids = [student.id for student, _ in roster]
    histories = defaultdict(list)
    predictions = {}
    active = set()
    if ids:
        # One extra week allows comparison with last week's trajectory. No per-student SQL.
        rows = db.scalars(
            select(WeeklyRecord)
            .where(
                WeeklyRecord.school_id == teacher.school_id,
                WeeklyRecord.course_offering_id == course_id,
                WeeklyRecord.student_id.in_(ids),
                WeeklyRecord.week_start.between(
                    week_anchor(as_of_date) - timedelta(weeks=8), as_of_date
                ),
            )
            .order_by(WeeklyRecord.week_start)
        )
        for row in rows:
            histories[row.student_id].append(row)
        latest = db.execute(
            select(RiskPrediction, FeatureSnapshot.as_of_date)
            .join(FeatureSnapshot, FeatureSnapshot.id == RiskPrediction.feature_snapshot_id)
            .where(
                RiskPrediction.school_id == teacher.school_id,
                FeatureSnapshot.school_id == teacher.school_id,
                RiskPrediction.course_offering_id == course_id,
                FeatureSnapshot.course_offering_id == course_id,
                RiskPrediction.student_id.in_(ids),
                FeatureSnapshot.as_of_date <= as_of_date,
            )
            .distinct(RiskPrediction.student_id)
            .order_by(
                RiskPrediction.student_id,
                FeatureSnapshot.as_of_date.desc(),
                RiskPrediction.created_at.desc(),
                RiskPrediction.id.desc(),
            )
        )
        predictions = {row.student_id: (row, day) for row, day in latest}
        active = set(
            db.scalars(
                select(Intervention.student_id).where(
                    Intervention.school_id == teacher.school_id,
                    Intervention.course_offering_id == course_id,
                    Intervention.student_id.in_(ids),
                    Intervention.status.in_(OPEN_STATUSES),
                    Intervention.start_date <= as_of_date,
                )
            )
        )
    students = []
    for student, user in roster:
        features = history_features(histories[student.id], as_of_date).features
        trend = trajectory(features)
        prior = trajectory(
            history_features(histories[student.id], as_of_date - timedelta(weeks=1)).features
        )
        predicted = predictions.get(student.id)
        prediction, prediction_date = predicted if predicted else (None, None)
        signals = prediction.explanations if prediction else []
        students.append(
            DashboardStudent(
                student_id=student.id,
                name=f"{user.first_name} {user.last_name}",
                roll_number=student.roll_number,
                support_level=SUPPORT[prediction.risk_level] if prediction else "not_assessed",
                prediction_as_of_date=prediction_date,
                trajectory=trend,
                newly_declining=trend == "declining" and prior in ("stable", "improving"),
                latest_score=features["avg_score"],
                attendance=features["attendance_percent"],
                top_signal=signals[0].get("message") if signals else None,
                active_intervention=student.id in active,
            )
        )
    counts = DashboardCounts(
        students=len(students),
        **{
            level: sum(s.support_level == level for s in students)
            for level in (*SUPPORT.values(), "not_assessed")
        },
        newly_declining=sum(s.newly_declining for s in students),
    )
    priority = {"priority_support": 0, "watch": 1, "not_assessed": 2, "doing_well": 3}

    def ordering(student):
        tie = (student.name.casefold(), str(student.student_id))
        if sort == "name":
            return tie
        if sort in ("attendance", "score"):
            value = student.attendance if sort == "attendance" else student.latest_score
            return (value is None, value if value is not None else 0, *tie)
        return (
            priority[student.support_level],
            not student.newly_declining,
            student.trajectory != "declining",
            *tie,
        )

    students.sort(key=ordering)
    return RiskSummary(
        course=CourseResponse.model_validate(course),
        as_of_date=as_of_date,
        counts=counts,
        students=students[offset : offset + limit],
        limit=limit,
        offset=offset,
    )
