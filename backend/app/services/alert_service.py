from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.core.enums import Role
from app.core.permissions import teacher_course_ids
from app.models import (
    CourseOffering,
    FeatureSnapshot,
    Intervention,
    RiskPrediction,
    StudentProfile,
    User,
    WeeklyRecord,
)
from app.models.intervention import OPEN_STATUSES
from app.schemas.alert import AlertCounts, AlertFeed, AlertItem
from app.schemas.school import CourseResponse

# A probability move of at least five points between consecutive predictions
# counts as a real trajectory change, not run-to-run noise.
RISE_DELTA = 0.05
PRIORITY = ("declining", "needs_support", "new_data", "improving")
SUPPORT = {"low": "doing_well", "medium": "watch", "high": "priority_support"}


def _top_predictions(db: Session, school_id: UUID, course_ids: list[UUID], as_of: date):
    """Two most recent predictions per (student, course), set-based."""
    rn = (
        func.row_number()
        .over(
            partition_by=(
                RiskPrediction.student_id,
                RiskPrediction.course_offering_id,
            ),
            order_by=(
                FeatureSnapshot.as_of_date.desc(),
                RiskPrediction.created_at.desc(),
                RiskPrediction.id.desc(),
            ),
        )
        .label("rn")
    )
    ranked = (
        select(
            RiskPrediction,
            rn,
            FeatureSnapshot.as_of_date.label("snapshot_date"),
        )
        .join(FeatureSnapshot, FeatureSnapshot.id == RiskPrediction.feature_snapshot_id)
        .where(
            RiskPrediction.school_id == school_id,
            FeatureSnapshot.school_id == school_id,
            RiskPrediction.course_offering_id.in_(course_ids),
            FeatureSnapshot.course_offering_id.in_(course_ids),
            FeatureSnapshot.as_of_date <= as_of,
        )
    ).subquery()
    prediction = aliased(RiskPrediction, ranked)
    rows = db.execute(
        select(prediction, ranked.c.snapshot_date, ranked.c.rn)
        .where(ranked.c.rn <= 2)
        .order_by(ranked.c.student_id, ranked.c.course_offering_id, ranked.c.rn)
    ).all()
    latest: dict[tuple[UUID, UUID], tuple[RiskPrediction, date]] = {}
    previous: dict[tuple[UUID, UUID], float] = {}
    for row, day, rank in rows:
        key = (row.student_id, row.course_offering_id)
        if rank == 1:
            latest[key] = (row, day)
        else:
            previous[key] = float(row.risk_probability)
    return latest, previous


def alert_feed(
    db: Session,
    teacher: User,
    as_of_date: date,
    limit: int,
    offset: int,
) -> AlertFeed:
    course_ids = teacher_course_ids(db, teacher)
    as_of = min(as_of_date, datetime.now(UTC).date())
    if not course_ids:
        return AlertFeed(
            as_of_date=as_of, counts=AlertCounts(), alerts=[], limit=limit, offset=offset
        )
    latest, previous = _top_predictions(db, teacher.school_id, course_ids, as_of)
    if not latest:
        return AlertFeed(
            as_of_date=as_of, counts=AlertCounts(), alerts=[], limit=limit, offset=offset
        )

    keys = list(latest)
    latest_weeks = {
        (row.student_id, row.course_offering_id): row.week_start
        for row in db.execute(
            select(
                WeeklyRecord.student_id,
                WeeklyRecord.course_offering_id,
                func.max(WeeklyRecord.week_start).label("week_start"),
            )
            .where(
                WeeklyRecord.school_id == teacher.school_id,
                WeeklyRecord.course_offering_id.in_(course_ids),
            )
            .group_by(WeeklyRecord.student_id, WeeklyRecord.course_offering_id)
        ).all()
    }
    supported = {
        (row.student_id, row.course_offering_id)
        for row in db.execute(
            select(Intervention.student_id, Intervention.course_offering_id)
            .where(
                Intervention.school_id == teacher.school_id,
                Intervention.course_offering_id.in_(course_ids),
                Intervention.status.in_(OPEN_STATUSES),
            )
            .distinct()
        ).all()
    }
    people = {
        profile.id: (profile, user)
        for profile, user in db.execute(
            select(StudentProfile, User)
            .join(User, User.id == StudentProfile.user_id)
            .where(
                StudentProfile.school_id == teacher.school_id,
                User.school_id == teacher.school_id,
                User.role == Role.STUDENT,
                User.is_active.is_(True),
                StudentProfile.id.in_({key[0] for key in keys}),
            )
        ).all()
    }
    courses = {
        course.id: course
        for course in db.scalars(
            select(CourseOffering)
            .options(
                selectinload(CourseOffering.subject),
                selectinload(CourseOffering.classroom),
            )
            .where(
                CourseOffering.school_id == teacher.school_id,
                CourseOffering.id.in_({key[1] for key in keys}),
            )
        )
    }

    items: list[AlertItem] = []
    for key, (row, day) in latest.items():
        person = people.get(key[0])
        course = courses.get(key[1])
        if person is None or course is None:
            continue
        profile, user = person
        probability = float(row.risk_probability)
        prior = previous.get(key)
        delta = round(probability - prior, 4) if prior is not None else None
        # One kind per alert, ordered by urgency: a rising risk always wins,
        # then an unsupported at-risk student, then newer raw data, then a
        # recovery worth acknowledging. Quiet students stay out of the feed.
        if delta is not None and delta >= RISE_DELTA:
            kind = "declining"
        elif row.at_risk and key not in supported:
            kind = "needs_support"
        elif latest_weeks.get(key, day) > day:
            kind = "new_data"
        elif delta is not None and delta <= -RISE_DELTA:
            kind = "improving"
        else:
            continue
        items.append(
            AlertItem(
                student_id=key[0],
                name=f"{user.first_name} {user.last_name}",
                roll_number=profile.roll_number,
                course_offering_id=key[1],
                course=CourseResponse.model_validate(course),
                course_label=f"{course.classroom.name} · {course.subject.name}",
                prediction_id=row.id,
                as_of_date=day,
                risk_probability=probability,
                previous_probability=prior,
                probability_delta=delta,
                risk_level=row.risk_level,
                at_risk=row.at_risk,
                support_level=SUPPORT[row.risk_level],
                top_signals=list(row.explanations)[:3],
                recommendation_name=(
                    row.recommendations[0]["name"] if row.recommendations else None
                ),
                active_intervention=key in supported,
                kind=kind,
            )
        )
    items.sort(
        key=lambda a: (
            PRIORITY.index(a.kind),
            not a.at_risk,
            -(a.probability_delta if a.probability_delta is not None else 0.0),
            -a.risk_probability,
            a.name.casefold(),
            str(a.student_id),
            str(a.course_offering_id),
        )
    )
    counts = AlertCounts(
        total=len(items),
        **{kind: sum(a.kind == kind for a in items) for kind in PRIORITY},
    )
    return AlertFeed(
        as_of_date=as_of,
        counts=counts,
        alerts=items[offset : offset + limit],
        limit=limit,
        offset=offset,
    )
