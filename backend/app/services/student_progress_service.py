from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import EnrollmentStatus
from app.core.exceptions import APIError
from app.ml.feature_builder import percentage
from app.models import (
    Classroom,
    CourseOffering,
    Enrollment,
    Intervention,
    StudentProfile,
    Subject,
    User,
    WeeklyRecord,
)
from app.schemas.progress import (
    AssignmentProgress,
    CourseInfo,
    CourseProgress,
    GoalTargets,
    ProgressEvent,
    ProgressMetric,
    StudentDashboard,
    StudentGoal,
    StudentProgress,
    VisibleIntervention,
    WeeklyProgress,
)
from app.services.progress_metrics import history_features, metric_trend, week_anchor
from app.services.weekly_record_service import authorized_enrollment


def own_student(db: Session, user: User) -> StudentProfile:
    student = db.scalar(
        select(StudentProfile).where(
            StudentProfile.school_id == user.school_id,
            StudentProfile.user_id == user.id,
        )
    )
    if student is None:
        raise APIError(404, "STUDENT_NOT_FOUND", "Student profile not found.")
    return student


def enrolled_courses(
    db: Session, school_id: UUID, student_id: UUID, course_id: UUID | None
) -> list:
    query = (
        select(CourseOffering, Classroom.name, Subject.name, Subject.code)
        .join(Classroom, Classroom.id == CourseOffering.classroom_id)
        .join(Subject, Subject.id == CourseOffering.subject_id)
        .join(Enrollment, Enrollment.course_offering_id == CourseOffering.id)
        .where(
            CourseOffering.school_id == school_id,
            Classroom.school_id == school_id,
            Subject.school_id == school_id,
            Enrollment.school_id == school_id,
            Enrollment.student_id == student_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
            Enrollment.enrolled_at <= datetime.now(UTC).date(),
            CourseOffering.is_active.is_(True),
            Classroom.is_active.is_(True),
        )
    )
    if course_id is not None:
        query = query.where(CourseOffering.id == course_id)
    rows = db.execute(query.order_by(CourseOffering.id)).all()
    if course_id is not None and not rows:
        raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
    return rows


def on_time_streak(rows: list[WeeklyRecord], day: date) -> int | None:
    if not rows:
        return None
    by_week = {r.week_start: r for r in rows}
    current, earliest, streak = week_anchor(day), min(by_week), 0
    while current >= earliest:
        row = by_week.get(current)
        if row is None:
            return None
        if row.late_submissions is not None and row.late_submissions > 0:
            return streak
        if any(
            v is None
            for v in (row.assignment_count, row.assignments_completed, row.late_submissions)
        ):
            return None
        if row.assignment_count == 0 or row.assignments_completed != row.assignment_count:
            return streak
        streak += 1
        current -= timedelta(weeks=1)
    return streak


def progress_for_student(
    db: Session,
    school_id: UUID,
    student_id: UUID,
    course_id: UUID | None,
    as_of_date: date,
    history_weeks: int = 8,
) -> StudentProgress:
    courses = enrolled_courses(db, school_id, student_id, course_id)
    histories = defaultdict(list)
    if courses:
        for row in db.scalars(
            select(WeeklyRecord)
            .where(
                WeeklyRecord.school_id == school_id,
                WeeklyRecord.student_id == student_id,
                WeeklyRecord.course_offering_id.in_([c.id for c, *_ in courses]),
                WeeklyRecord.week_start.between(
                    week_anchor(as_of_date) - timedelta(weeks=history_weeks - 1), as_of_date
                ),
            )
            .order_by(WeeklyRecord.week_start)
        ):
            histories[row.course_offering_id].append(row)
    output = []
    for course, classroom_name, subject_name, subject_code in courses:
        rows = histories[course.id]
        features = history_features(rows, as_of_date).features
        current = next((r for r in rows if r.week_start == week_anchor(as_of_date)), None)
        total = current.assignment_count if current else None
        completed = current.assignments_completed if current else None
        streak = on_time_streak(rows, as_of_date)
        events = []
        for key, code in (
            ("attendance_change_4wk", "attendance_improvement"),
            ("score_change_4wk", "score_improvement"),
        ):
            if features[key] is not None and features[key] > 0:
                events.append(ProgressEvent(code=code, value=features[key]))
        if streak is not None and streak >= 2:
            events.append(ProgressEvent(code="on_time_submission_streak", value=streak))
        output.append(
            CourseProgress(
                course=CourseInfo(
                    id=course.id,
                    classroom_name=classroom_name,
                    subject_name=subject_name,
                    subject_code=subject_code,
                    academic_year=course.academic_year,
                ),
                attendance=ProgressMetric(
                    current=features["attendance_percent"],
                    change_4wk=features["attendance_change_4wk"],
                    trend=metric_trend(features["attendance_change_4wk"], 8),
                ),
                academic=ProgressMetric(
                    current=features["avg_score"],
                    change_4wk=features["score_change_4wk"],
                    trend=metric_trend(features["score_change_4wk"], 10),
                ),
                assignments=AssignmentProgress(
                    total=total,
                    completed=completed,
                    completion_percent=percentage(completed, total),
                    on_time_streak_weeks=streak,
                ),
                improvements=events,
                weeks=[
                    WeeklyProgress(
                        week_start=r.week_start,
                        attendance_percent=percentage(r.classes_attended, r.classes_held),
                        assessment_avg_score=r.assessment_avg_score,
                        assignment_count=r.assignment_count,
                        assignments_completed=r.assignments_completed,
                        late_submissions=r.late_submissions,
                    )
                    for r in rows
                ],
            )
        )
    return StudentProgress(student_id=student_id, as_of_date=as_of_date, courses=output)


def progress(
    db: Session, user: User, course_id: UUID | None, day: date, history_weeks: int = 8
) -> StudentProgress:
    student = own_student(db, user)
    return progress_for_student(db, user.school_id, student.id, course_id, day, history_weeks)


def teacher_progress(
    db: Session, user: User, student_id: UUID, course_id: UUID, day: date
) -> StudentProgress:
    authorized_enrollment(db, user, student_id, course_id)
    return progress_for_student(db, user.school_id, student_id, course_id, day)


def visible_interventions(
    db: Session, user: User, course_id: UUID | None, limit: int, offset: int
) -> list[VisibleIntervention]:
    student = own_student(db, user)
    courses = enrolled_courses(db, user.school_id, student.id, course_id)
    if not courses:
        return []
    rows = db.scalars(
        select(Intervention)
        .where(
            Intervention.school_id == user.school_id,
            Intervention.student_id == student.id,
            Intervention.course_offering_id.in_([c.id for c, *_ in courses]),
            Intervention.visibility_to_student.is_(True),
        )
        .order_by(Intervention.created_at.desc(), Intervention.id)
        .limit(limit)
        .offset(offset)
    )
    # Never fetch/join update notes, model snapshots, predictions or template descriptions.
    return [
        VisibleIntervention(
            id=r.id,
            course_offering_id=r.course_offering_id,
            title=r.title,
            status=r.status,
            start_date=r.start_date,
            review_date=r.review_date,
            completed_at=r.completed_at,
            goal_definition=GoalTargets(**r.goal_definition),
        )
        for r in rows
    ]


def goals(interventions: list[VisibleIntervention]) -> list[StudentGoal]:
    return [
        StudentGoal(
            intervention_id=i.id,
            course_offering_id=i.course_offering_id,
            title=i.title,
            targets=i.goal_definition,
        )
        for i in interventions
        if any(v is not None for v in i.goal_definition.model_dump().values())
    ]


def dashboard(db: Session, user: User, course_id: UUID | None, day: date) -> StudentDashboard:
    measured = progress(db, user, course_id, day)
    visible = visible_interventions(db, user, course_id, 101, 0)
    return StudentDashboard(
        **measured.model_dump(),
        visible_interventions=visible[:100],
        interventions_has_more=len(visible) > 100,
        goals=goals(visible[:100]),
    )
