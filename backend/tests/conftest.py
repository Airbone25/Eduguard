from datetime import date
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import get_settings
from app.core.enums import Role
from app.db.base import Base
from app.db.seed import DEMO_PASSWORD, seed_demo
from app.db.session import create_db_engine, get_db
from app.main import app
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
from app.schemas.auth import LoginRequest
from app.services.auth_service import login


@pytest.fixture(scope="session")
def pg_engine():
    """Migrate a fresh, isolated schema; never drop/truncate application tables."""
    schema = "eduguard_test_" + uuid4().hex
    url = get_settings().database_url
    admin = create_db_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_db_engine(url, schema=schema)

    try:
        with engine.begin() as connection:
            config = Config("alembic.ini")
            config.attributes["connection"] = connection
            config.attributes["version_table_schema"] = schema
            command.upgrade(config, "head")
            assert (
                connection.scalar(
                    text(
                        "SELECT count(*) FROM information_schema.tables "
                        "WHERE table_schema = :schema"
                    ),
                    {"schema": schema},
                )
                == len(Base.metadata.tables) + 1
            )
        with Session(engine) as session:
            seed_demo(session)
            session.commit()
        yield engine
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def db(pg_engine):
    with pg_engine.connect() as connection:
        transaction = connection.begin()
        assert connection.scalar(text("SELECT current_schema()")).startswith("eduguard_test_")
        with Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        ) as session:
            yield session
        transaction.rollback()


@pytest.fixture
def demo(db):
    return seed_demo(db)


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db):
    def authenticate(name="admin", slug="demo"):
        tokens = login(
            db, LoginRequest(school_slug=slug, email=f"{name}@demo.edu", password=DEMO_PASSWORD)
        )
        return {"Authorization": f"Bearer {tokens.access_token}"}

    return authenticate


@pytest.fixture
def school_b(db):
    school = School(name="School B", slug="school-b")
    db.add(school)
    db.flush()
    result = {"school": school}
    for name, role in [
        ("admin", Role.SCHOOL_ADMIN),
        ("teacher", Role.TEACHER),
        ("student", Role.STUDENT),
    ]:
        original = db.scalar(select(User).where(User.role == role))
        user = User(
            school_id=school.id,
            email=f"{name}@demo.edu",
            role=role,
            password_hash=original.password_hash,
            first_name="B",
            last_name=name,
        )
        db.add(user)
        db.flush()
        result[name] = user
    teacher = TeacherProfile(school_id=school.id, user_id=result["teacher"].id)
    student = StudentProfile(
        school_id=school.id, user_id=result["student"].id, roll_number="B001", grade_label="10"
    )
    classroom = Classroom(
        school_id=school.id, name="B class", grade_label="10", academic_year="2026"
    )
    subject = Subject(school_id=school.id, name="History", code="HIST")
    db.add_all([teacher, student, classroom, subject])
    db.flush()
    course = CourseOffering(
        school_id=school.id, classroom_id=classroom.id, subject_id=subject.id, academic_year="2026"
    )
    db.add(course)
    db.flush()
    db.add_all(
        [
            CourseTeacher(school_id=school.id, teacher_id=teacher.id, course_offering_id=course.id),
            Enrollment(
                school_id=school.id,
                student_id=student.id,
                course_offering_id=course.id,
                enrolled_at=date(2026, 1, 1),
            ),
        ]
    )
    db.flush()
    return {
        **result,
        "teacher_profile": teacher,
        "student_profile": student,
        "classroom": classroom,
        "subject": subject,
        "course": course,
    }
