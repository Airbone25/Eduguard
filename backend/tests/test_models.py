import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.enums import Role
from app.db.seed import seed_demo
from app.models import CourseOffering, Enrollment, School, StudentProfile, Subject, User


def test_seed_idempotent_and_relationships(db, demo):
    assert seed_demo(db).id == demo.id
    assert db.scalar(select(func.count()).select_from(User)) == 3
    assert db.scalar(select(func.count()).select_from(Subject)) == 3
    course = db.scalar(select(CourseOffering))
    assert course.classroom.name == "Grade 10-A"
    assert course.subject.name == "Mathematics"
    assert course.teacher_assignments[0].teacher.user.role == Role.TEACHER
    assert course.enrollments[0].student.user.role == Role.STUDENT
    assert course.created_at.utcoffset().total_seconds() == 0


def test_case_insensitive_email_uniqueness_and_school_scope(db, demo):
    other = School(name="Other school", slug="other")
    db.add(other)
    db.flush()
    fields = dict(
        email="ADMIN@demo.edu",
        password_hash="not-a-login-hash",
        role=Role.SCHOOL_ADMIN,
        first_name="A",
        last_name="B",
    )
    db.add(User(school_id=other.id, **fields))
    db.flush()
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(User(school_id=demo.id, **fields))
        db.flush()


def test_database_rejects_cross_school_enrollment(db, demo):
    other = School(name="Other", slug="other")
    db.add(other)
    db.flush()
    enrollment = db.scalar(select(Enrollment))
    with pytest.raises(IntegrityError), db.begin_nested():
        enrollment.school_id = other.id
        db.flush()


@pytest.mark.parametrize(
    "model,fields",
    [
        (School, {"name": "Duplicate", "slug": "demo"}),
        (Subject, {"code": "MATH", "name": "Duplicate"}),
    ],
)
def test_unique_school_and_subject(db, demo, model, fields):
    if model is Subject:
        fields = {**fields, "school_id": demo.id}
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(model(**fields))
        db.flush()


def test_duplicate_enrollment(db, demo):
    enrollment = db.scalar(select(Enrollment))
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(
            Enrollment(
                school_id=demo.id,
                student_id=enrollment.student_id,
                course_offering_id=enrollment.course_offering_id,
                enrolled_at=enrollment.enrolled_at,
            )
        )
        db.flush()


def test_duplicate_roll_number(db, demo):
    student = db.scalar(select(StudentProfile))
    second_user = User(
        school_id=demo.id,
        email="second@demo.edu",
        role=Role.STUDENT,
        password_hash=student.user.password_hash,
        first_name="Second",
        last_name="Student",
    )
    db.add(second_user)
    db.flush()
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(
            StudentProfile(
                school_id=demo.id,
                user_id=second_user.id,
                roll_number=student.roll_number,
                grade_label="10",
            )
        )
        db.flush()
