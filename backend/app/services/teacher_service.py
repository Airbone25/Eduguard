from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import EnrollmentStatus, Role
from app.core.exceptions import APIError
from app.core.permissions import authorized_student, teacher_has_course_access
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    StudentProfile,
    TeacherProfile,
    User,
)


def list_courses(db: Session, teacher: User, limit: int, offset: int) -> list[CourseOffering]:
    return list(
        db.scalars(
            select(CourseOffering)
            .options(selectinload(CourseOffering.classroom), selectinload(CourseOffering.subject))
            .join(Classroom, Classroom.id == CourseOffering.classroom_id)
            .join(CourseTeacher, CourseTeacher.course_offering_id == CourseOffering.id)
            .join(TeacherProfile, TeacherProfile.id == CourseTeacher.teacher_id)
            .where(
                CourseOffering.school_id == teacher.school_id,
                Classroom.school_id == teacher.school_id,
                CourseTeacher.school_id == teacher.school_id,
                TeacherProfile.school_id == teacher.school_id,
                TeacherProfile.user_id == teacher.id,
                Classroom.is_active.is_(True),
                CourseOffering.is_active.is_(True),
            )
            .order_by(CourseOffering.id)
            .limit(limit)
            .offset(offset)
        )
    )


def list_students(
    db: Session, teacher: User, course_id: UUID, limit: int, offset: int
) -> list[StudentProfile]:
    if not teacher_has_course_access(db, teacher, course_id):
        raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
    return list(
        db.scalars(
            select(StudentProfile)
            .join(User, User.id == StudentProfile.user_id)
            .join(Enrollment, Enrollment.student_id == StudentProfile.id)
            .where(
                StudentProfile.school_id == teacher.school_id,
                User.school_id == teacher.school_id,
                Enrollment.school_id == teacher.school_id,
                Enrollment.course_offering_id == course_id,
                Enrollment.status == EnrollmentStatus.ACTIVE,
                Enrollment.enrolled_at <= datetime.now(UTC).date(),
                User.is_active.is_(True),
                User.role == Role.STUDENT,
            )
            .options(selectinload(StudentProfile.user))
            .order_by(StudentProfile.id)
            .limit(limit)
            .offset(offset)
        )
    )


def student_detail(db: Session, teacher: User, student_id: UUID) -> StudentProfile:
    return authorized_student(db, teacher, student_id)
