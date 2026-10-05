from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.enums import Role
from app.core.exceptions import APIError
from app.core.security import hash_password
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    RefreshToken,
    StudentProfile,
    Subject,
    TeacherProfile,
    User,
)
from app.schemas.school import (
    ClassroomCreate,
    CourseCreate,
    StudentCreate,
    StudentEnrollment,
    SubjectCreate,
    TeacherAssignment,
    TeacherCreate,
    UserPatch,
)
from app.services.common import audit, tenant_row, transaction


def list_rows(db: Session, actor: User, model, limit: int, offset: int) -> list:
    return list(
        db.scalars(
            select(model)
            .where(model.school_id == actor.school_id)
            .order_by(model.id)
            .limit(limit)
            .offset(offset)
        )
    )


def create_user(db: Session, actor: User, data: TeacherCreate | StudentCreate):
    teacher = isinstance(data, TeacherCreate)
    fields = data.model_dump(exclude={"password", "email", "first_name", "last_name"})
    with transaction(db):
        user = User(
            school_id=actor.school_id,
            email=str(data.email),
            first_name=data.first_name,
            last_name=data.last_name,
            password_hash=hash_password(data.password.get_secret_value()),
            role=Role.TEACHER if teacher else Role.STUDENT,
        )
        db.add(user)
        db.flush()
        profile = (TeacherProfile if teacher else StudentProfile)(
            school_id=actor.school_id, user_id=user.id, **fields
        )
        db.add(profile)
        db.flush()
        audit(db, actor, "user.created", "user", user.id, {"role": user.role.value})
    return profile


def patch_user(db: Session, actor: User, user_id: UUID, data: UserPatch) -> User:
    with transaction(db):
        user = tenant_row(db, User, actor.school_id, user_id, lock=True)
        if user.id == actor.id and data.is_active is False:
            raise APIError(400, "SELF_DEACTIVATION", "You cannot deactivate your own account.")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        if data.is_active is False:
            db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.school_id == actor.school_id,
                    RefreshToken.user_id == user.id,
                    RefreshToken.revoked_at.is_(None),
                )
                .values(revoked_at=datetime.now(UTC))
            )
        audit(db, actor, "user.updated", "user", user.id, {"fields": sorted(data.model_fields_set)})
    return user


def create_structure(
    db: Session, actor: User, data: ClassroomCreate | SubjectCreate | CourseCreate
):
    model = {ClassroomCreate: Classroom, SubjectCreate: Subject, CourseCreate: CourseOffering}[
        type(data)
    ]
    with transaction(db):
        if isinstance(data, CourseCreate):
            classroom = tenant_row(db, Classroom, actor.school_id, data.classroom_id)
            tenant_row(db, Subject, actor.school_id, data.subject_id)
            if not classroom.is_active or classroom.academic_year != data.academic_year:
                raise APIError(
                    422, "INVALID_CLASSROOM", "Use an active classroom in the same academic year."
                )
        row = model(school_id=actor.school_id, **data.model_dump())
        db.add(row)
        db.flush()
        audit(db, actor, "structure.created", model.__tablename__, row.id)
    return row


def assign_teacher(db: Session, actor: User, course_id: UUID, data: TeacherAssignment):
    with transaction(db):
        course = tenant_row(db, CourseOffering, actor.school_id, course_id, lock=True)
        profile = tenant_row(db, TeacherProfile, actor.school_id, data.teacher_id)
        teacher = tenant_row(db, User, actor.school_id, profile.user_id)
        if not course.is_active or not teacher.is_active or teacher.role != Role.TEACHER:
            raise APIError(422, "INVALID_ASSIGNMENT", "An active course and teacher are required.")
        row = CourseTeacher(
            school_id=actor.school_id, course_offering_id=course_id, **data.model_dump()
        )
        db.add(row)
        db.flush()
        audit(
            db,
            actor,
            "teacher.assigned",
            "course_offering",
            course_id,
            {"teacher_id": str(profile.id)},
        )
    return row


def enroll_student(db: Session, actor: User, course_id: UUID, data: StudentEnrollment):
    with transaction(db):
        course = tenant_row(db, CourseOffering, actor.school_id, course_id, lock=True)
        profile = tenant_row(db, StudentProfile, actor.school_id, data.student_id)
        student = tenant_row(db, User, actor.school_id, profile.user_id)
        if not course.is_active or not student.is_active or student.role != Role.STUDENT:
            raise APIError(422, "INVALID_ENROLLMENT", "An active course and student are required.")
        row = Enrollment(
            school_id=actor.school_id, course_offering_id=course_id, **data.model_dump()
        )
        db.add(row)
        db.flush()
        audit(
            db,
            actor,
            "student.enrolled",
            "enrollment",
            row.id,
            {"student_id": str(profile.id), "course_offering_id": str(course_id)},
        )
    return row
