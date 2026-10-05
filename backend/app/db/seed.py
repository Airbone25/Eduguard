from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import Role
from app.core.security import hash_password
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    School,
    StudentProfile,
    Subject,
    TeacherProfile,
    User,
)

DEMO_PASSWORD = "EduGuard-Demo-2026!"


def seed_demo(db: Session) -> School:
    """Create the fixture atomically. Existing fixture is left completely unchanged."""
    existing = db.scalar(select(School).where(School.slug == "demo"))
    if existing:
        return existing
    school = School(name="Demo Public School", slug="demo")
    db.add(school)
    db.flush()
    users = {}
    for name, role in [
        ("admin", Role.SCHOOL_ADMIN),
        ("teacher", Role.TEACHER),
        ("student", Role.STUDENT),
    ]:
        user = User(
            school_id=school.id,
            email=f"{name}@demo.edu",
            role=role,
            password_hash=hash_password(DEMO_PASSWORD),
            first_name="Demo",
            last_name=name.title(),
        )
        db.add(user)
        users[name] = user
    db.flush()
    teacher = TeacherProfile(school_id=school.id, user_id=users["teacher"].id, employee_code="T001")
    student = StudentProfile(
        school_id=school.id, user_id=users["student"].id, roll_number="S001", grade_label="10"
    )
    classroom = Classroom(
        school_id=school.id, name="Grade 10-A", grade_label="10", academic_year="2026"
    )
    subjects = [
        Subject(school_id=school.id, code=code, name=name)
        for code, name in [("MATH", "Mathematics"), ("PHY", "Physics"), ("CHEM", "Chemistry")]
    ]
    db.add_all([teacher, student, classroom, *subjects])
    db.flush()
    course = CourseOffering(
        school_id=school.id,
        classroom_id=classroom.id,
        subject_id=subjects[0].id,
        academic_year="2026",
    )
    db.add(course)
    db.flush()
    db.add_all(
        [
            CourseTeacher(
                school_id=school.id,
                course_offering_id=course.id,
                teacher_id=teacher.id,
                is_primary=True,
            ),
            Enrollment(
                school_id=school.id,
                student_id=student.id,
                course_offering_id=course.id,
                enrolled_at=date(2026, 1, 1),
            ),
        ]
    )
    db.flush()
    return school
