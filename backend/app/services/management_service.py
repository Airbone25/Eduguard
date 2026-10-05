from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import EnrollmentStatus
from app.core.exceptions import APIError
from app.models import CourseOffering, CourseTeacher, Enrollment, School, User
from app.services.common import audit, tenant_row, transaction


def profiles(db: Session, actor: User, model, limit: int, offset: int):
    return list(
        db.scalars(
            select(model)
            .where(model.school_id == actor.school_id)
            .options(selectinload(model.user))
            .order_by(model.id)
            .limit(limit)
            .offset(offset)
        )
    )


def patch_structure(db: Session, actor: User, model, row_id: UUID, data):
    with transaction(db):
        row = tenant_row(db, model, actor.school_id, row_id, lock=True)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        audit(db, actor, "structure.updated", model.__tablename__, row.id)
    return row


def course_members(db: Session, actor: User, course_id: UUID, model, limit: int, offset: int):
    tenant_row(db, CourseOffering, actor.school_id, course_id)
    ordering = model.teacher_id if model is CourseTeacher else model.id
    return list(
        db.scalars(
            select(model)
            .where(model.school_id == actor.school_id, model.course_offering_id == course_id)
            .order_by(ordering)
            .limit(limit)
            .offset(offset)
        )
    )


def unassign(db: Session, actor: User, course_id: UUID, teacher_id: UUID):
    with transaction(db):
        tenant_row(db, CourseOffering, actor.school_id, course_id, lock=True)
        row = db.scalar(
            select(CourseTeacher).where(
                CourseTeacher.school_id == actor.school_id,
                CourseTeacher.course_offering_id == course_id,
                CourseTeacher.teacher_id == teacher_id,
            )
        )
        if row is None:
            raise APIError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.")
        db.delete(row)
        audit(
            db,
            actor,
            "teacher.unassigned",
            "course_offering",
            course_id,
            {"teacher_id": str(teacher_id)},
        )


def enrollment_status(db: Session, actor: User, row_id: UUID, status: EnrollmentStatus):
    with transaction(db):
        row = tenant_row(db, Enrollment, actor.school_id, row_id, lock=True)
        if status == EnrollmentStatus.ACTIVE:
            course = tenant_row(db, CourseOffering, actor.school_id, row.course_offering_id)
            if not course.is_active:
                raise APIError(422, "INACTIVE_COURSE", "Activate the course before re-enrolling.")
        row.status = status
        audit(db, actor, "enrollment.updated", "enrollment", row.id, {"status": status.value})
    return row


def school(db: Session, actor: User, data=None):
    query = select(School).where(School.id == actor.school_id)
    if data is None:
        return db.scalar(query)
    with transaction(db):
        row = db.scalar(query.with_for_update())
        row.name = data.name
        audit(db, actor, "school.updated", "school", row.id)
    return row
