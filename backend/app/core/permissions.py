from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import EnrollmentStatus, Role
from app.core.exceptions import APIError
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    StudentProfile,
    TeacherProfile,
    User,
)


def assigned_course_query(user: User):
    """Single source of truth for an active teacher's own active course offerings."""
    return (
        select(CourseTeacher.course_offering_id)
        .join(TeacherProfile, TeacherProfile.id == CourseTeacher.teacher_id)
        .join(CourseOffering, CourseOffering.id == CourseTeacher.course_offering_id)
        .join(Classroom, Classroom.id == CourseOffering.classroom_id)
        .where(
            TeacherProfile.user_id == user.id,
            TeacherProfile.school_id == user.school_id,
            CourseTeacher.school_id == user.school_id,
            CourseOffering.school_id == user.school_id,
            Classroom.school_id == user.school_id,
            Classroom.is_active.is_(True),
            CourseOffering.is_active.is_(True),
        )
    )


def teacher_course_ids(db: Session, user: User) -> list[UUID]:
    if user.role != Role.TEACHER or not user.is_active:
        return []
    return list(db.scalars(assigned_course_query(user).distinct()))


def teacher_has_course_access(db: Session, user: User, course_id: UUID) -> bool:
    if user.role != Role.TEACHER or not user.is_active:
        return False
    return (
        db.scalar(
            assigned_course_query(user)
            .where(CourseTeacher.course_offering_id == course_id)
            .limit(1)
        )
        is not None
    )


def teacher_has_student_access(db: Session, user: User, student_id: UUID) -> bool:
    if user.role != Role.TEACHER or not user.is_active:
        return False
    return (
        db.scalar(
            select(Enrollment.id)
            .join(
                CourseTeacher,
                CourseTeacher.course_offering_id == Enrollment.course_offering_id,
            )
            .join(TeacherProfile, TeacherProfile.id == CourseTeacher.teacher_id)
            .join(CourseOffering, CourseOffering.id == Enrollment.course_offering_id)
            .join(Classroom, Classroom.id == CourseOffering.classroom_id)
            .join(StudentProfile, StudentProfile.id == Enrollment.student_id)
            .join(User, User.id == StudentProfile.user_id)
            .where(
                TeacherProfile.user_id == user.id,
                TeacherProfile.school_id == user.school_id,
                CourseTeacher.school_id == user.school_id,
                Enrollment.school_id == user.school_id,
                CourseOffering.school_id == user.school_id,
                StudentProfile.school_id == user.school_id,
                Classroom.school_id == user.school_id,
                User.school_id == user.school_id,
                Enrollment.student_id == student_id,
                Enrollment.status == EnrollmentStatus.ACTIVE,
                Enrollment.enrolled_at <= datetime.now(UTC).date(),
                CourseOffering.is_active.is_(True),
                Classroom.is_active.is_(True),
                User.is_active.is_(True),
                User.role == Role.STUDENT,
            )
            .limit(1)
        )
        is not None
    )


def authorized_student(db: Session, user: User, student_id: UUID) -> StudentProfile:
    student = db.scalar(
        select(StudentProfile).where(
            StudentProfile.id == student_id,
            StudentProfile.school_id == user.school_id,
        )
    )
    allowed = (
        student is not None
        and user.is_active
        and (
            user.role == Role.SCHOOL_ADMIN
            or (user.role == Role.STUDENT and student.user_id == user.id)
            or teacher_has_student_access(db, user, student_id)
        )
    )
    if not allowed:
        raise APIError(404, "STUDENT_NOT_FOUND", "Student not found.")
    return student
