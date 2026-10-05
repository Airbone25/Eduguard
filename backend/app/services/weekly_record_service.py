from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.enums import EnrollmentStatus, Role
from app.core.exceptions import APIError
from app.core.permissions import teacher_has_course_access
from app.models import Enrollment, StudentProfile, User, WeeklyRecord
from app.schemas.weekly_record import WeeklyData, WeeklyItem
from app.services.common import audit, transaction


def authorized_enrollment(
    db: Session, teacher: User, student_id: UUID, course_id: UUID
) -> Enrollment:
    if not teacher_has_course_access(db, teacher, course_id):
        raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
    row = db.scalar(
        select(Enrollment)
        .join(StudentProfile, StudentProfile.id == Enrollment.student_id)
        .join(User, User.id == StudentProfile.user_id)
        .where(
            Enrollment.school_id == teacher.school_id,
            Enrollment.student_id == student_id,
            Enrollment.course_offering_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
            Enrollment.enrolled_at <= datetime.now(UTC).date(),
            StudentProfile.school_id == teacher.school_id,
            User.school_id == teacher.school_id,
            User.is_active.is_(True),
            User.role == Role.STUDENT,
        )
    )
    if row is None:
        raise APIError(404, "STUDENT_NOT_FOUND", "Student not found.")
    return row


def write_one(
    db: Session, teacher: User, data: WeeklyItem, *, source: str = "manual"
) -> WeeklyRecord:
    values = data.model_dump(include=set(WeeklyData.model_fields))
    created = db.scalar(
        insert(WeeklyRecord)
        .values(
            school_id=teacher.school_id,
            student_id=data.student_id,
            course_offering_id=data.course_offering_id,
            week_start=data.week_start,
            created_by=teacher.id,
            source=source,
            **values,
        )
        .on_conflict_do_nothing(index_elements=["student_id", "course_offering_id", "week_start"])
        .returning(WeeklyRecord.id)
    )
    record = db.scalar(
        select(WeeklyRecord)
        .where(
            WeeklyRecord.school_id == teacher.school_id,
            WeeklyRecord.student_id == data.student_id,
            WeeklyRecord.course_offering_id == data.course_offering_id,
            WeeklyRecord.week_start == data.week_start,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    changed = sorted(name for name, value in values.items() if getattr(record, name) != value)
    if created is None and record.source != source:
        changed.append("source")
    if created is None:
        for name, value in values.items():
            setattr(record, name, value)
        record.source = source
    if created is not None or changed:
        audit(
            db,
            teacher,
            "weekly_record.created" if created else "weekly_record.updated",
            "weekly_record",
            record.id,
            {"fields": sorted(values) if created else changed},
        )
    db.flush()
    return record


def save_records(db: Session, teacher: User, records: list[WeeklyItem]) -> list[WeeklyRecord]:
    with transaction(db):
        for data in records:
            enrollment = authorized_enrollment(
                db, teacher, data.student_id, data.course_offering_id
            )
            if data.week_start + timedelta(days=6) < enrollment.enrolled_at:
                raise APIError(422, "WEEK_BEFORE_ENROLLMENT", "The week precedes enrollment.")
        # Stable locking order prevents crossed batch requests from deadlocking.
        keyed = sorted(records, key=lambda r: (r.student_id, r.course_offering_id, r.week_start))
        result = {
            (r.student_id, r.course_offering_id, r.week_start): write_one(db, teacher, r)
            for r in keyed
        }
    return [result[(r.student_id, r.course_offering_id, r.week_start)] for r in records]


def list_records(
    db: Session,
    teacher: User,
    student_id: UUID,
    course_id: UUID,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> list[WeeklyRecord]:
    authorized_enrollment(db, teacher, student_id, course_id)
    if date_from and date_to and date_from > date_to:
        raise APIError(422, "INVALID_DATE_RANGE", "date_from must be on or before date_to.")
    query = select(WeeklyRecord).where(
        WeeklyRecord.school_id == teacher.school_id,
        WeeklyRecord.student_id == student_id,
        WeeklyRecord.course_offering_id == course_id,
    )
    if date_from:
        query = query.where(WeeklyRecord.week_start >= date_from)
    if date_to:
        query = query.where(WeeklyRecord.week_start <= date_to)
    return list(db.scalars(query.order_by(WeeklyRecord.week_start).limit(limit).offset(offset)))
