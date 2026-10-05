from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.deps import (
    get_current_user,
    require_school_admin,
    require_student,
    require_teacher,
    require_teacher_course_access,
    require_teacher_student_access,
)
from app.core.enums import EnrollmentStatus, Role
from app.core.exceptions import install_error_handlers
from app.core.permissions import authorized_student
from app.db.seed import DEMO_PASSWORD
from app.db.session import get_db
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    School,
    StudentProfile,
    TeacherProfile,
    User,
)
from app.schemas.auth import LoginRequest
from app.services.auth_service import login


@pytest.fixture
def guard_client(db):
    # Test-only routes exercise real dependencies; no milestone 4/5 API is shipped.
    app = FastAPI()
    install_error_handlers(app)
    app.dependency_overrides[get_db] = lambda: db

    @app.get("/admin", dependencies=[Depends(require_school_admin)])
    def admin():
        return {"ok": True}

    @app.get("/teacher", dependencies=[Depends(require_teacher)])
    def teacher():
        return {"ok": True}

    @app.get("/student", dependencies=[Depends(require_student)])
    def student():
        return {"ok": True}

    @app.get("/students/{student_id}")
    def student_access(student_id: UUID, user: Annotated[User, Depends(get_current_user)]):
        return {"id": str(authorized_student(db, user, student_id).id)}

    @app.get("/teacher/students/{student_id}")
    def teacher_student(
        student: Annotated[StudentProfile, Depends(require_teacher_student_access)],
    ):
        return {"id": str(student.id)}

    @app.get("/teacher/courses/{course_id}")
    def teacher_course(course_id: Annotated[UUID, Depends(require_teacher_course_access)]):
        return {"id": str(course_id)}

    with TestClient(app) as client:
        yield client


def auth(db, name="teacher", slug="demo"):
    tokens = login(
        db, LoginRequest(school_slug=slug, email=f"{name}@demo.edu", password=DEMO_PASSWORD)
    )
    return {"Authorization": f"Bearer {tokens.access_token}"}


def test_role_matrix(guard_client, db):
    for name in ("admin", "teacher", "student"):
        headers = auth(db, name)
        for route in ("admin", "teacher", "student"):
            assert guard_client.get(f"/{route}", headers=headers).status_code == (
                200 if name == route else 403
            )


def test_assigned_teacher_and_student_self(guard_client, db, demo):
    student = db.scalar(select(StudentProfile))
    course = db.scalar(select(CourseOffering))
    for name in ("admin", "teacher", "student"):
        headers = auth(db, name)
        assert guard_client.get(f"/students/{student.id}", headers=headers).status_code == 200
        assert guard_client.get(f"/students/{uuid4()}", headers=headers).status_code == 404
    headers = auth(db)
    assert guard_client.get(f"/teacher/students/{student.id}", headers=headers).status_code == 200
    assert guard_client.get(f"/teacher/courses/{course.id}", headers=headers).status_code == 200


def test_unassigned_teacher_denied(guard_client, db, demo):
    student = db.scalar(select(StudentProfile))
    course = db.scalar(select(CourseOffering))
    teacher = db.scalar(select(User).where(User.role == Role.TEACHER))
    other = User(
        school_id=demo.id,
        email="unassigned@demo.edu",
        role=Role.TEACHER,
        password_hash=teacher.password_hash,
        first_name="Other",
        last_name="Teacher",
    )
    db.add(other)
    db.flush()
    db.add(TeacherProfile(school_id=demo.id, user_id=other.id))
    db.flush()
    headers = auth(db, "unassigned")
    assert guard_client.get(f"/teacher/students/{student.id}", headers=headers).status_code == 404
    assert guard_client.get(f"/teacher/courses/{course.id}", headers=headers).status_code == 404


def test_school_isolation_and_duplicate_email_login(guard_client, db, demo):
    target = db.scalar(select(StudentProfile))
    course = db.scalar(select(CourseOffering))
    other = School(name="School B", slug="school-b")
    db.add(other)
    db.flush()
    for name, role in [
        ("admin", Role.SCHOOL_ADMIN),
        ("teacher", Role.TEACHER),
        ("student", Role.STUDENT),
    ]:
        original = db.scalar(select(User).where(User.school_id == demo.id, User.role == role))
        user = User(
            school_id=other.id,
            email=original.email,
            password_hash=original.password_hash,
            role=role,
            first_name="School B",
            last_name=name,
        )
        db.add(user)
        db.flush()
        if role == Role.TEACHER:
            db.add(TeacherProfile(school_id=other.id, user_id=user.id))
        db.flush()
        headers = auth(db, name, "school-b")
        assert guard_client.get(f"/students/{target.id}", headers=headers).status_code == 404
        if role == Role.TEACHER:
            assert (
                guard_client.get(f"/teacher/courses/{course.id}", headers=headers).status_code
                == 404
            )


@pytest.mark.parametrize("invalid", ["withdrawn", "future", "course", "classroom", "assignment"])
def test_inactive_assignments_and_enrollments_denied(guard_client, db, invalid):
    student = db.scalar(select(StudentProfile))
    headers = auth(db)
    enrollment = db.scalar(select(Enrollment))
    if invalid == "withdrawn":
        enrollment.status = EnrollmentStatus.WITHDRAWN
    elif invalid == "future":
        enrollment.enrolled_at = datetime.now(UTC).date() + timedelta(days=1)
    elif invalid == "course":
        db.scalar(select(CourseOffering)).is_active = False
    elif invalid == "classroom":
        db.scalar(select(Classroom)).is_active = False
    else:
        db.delete(db.scalar(select(CourseTeacher)))
    db.flush()
    assert guard_client.get(f"/teacher/students/{student.id}", headers=headers).status_code == 404


def test_student_cannot_read_peer(guard_client, db, demo):
    own = db.scalar(select(StudentProfile))
    user = User(
        school_id=demo.id,
        email="peer@demo.edu",
        role=Role.STUDENT,
        password_hash=own.user.password_hash,
        first_name="Peer",
        last_name="Student",
    )
    db.add(user)
    db.flush()
    peer = StudentProfile(school_id=demo.id, user_id=user.id, roll_number="S002", grade_label="10")
    db.add(peer)
    db.flush()
    assert guard_client.get(f"/students/{peer.id}", headers=auth(db, "student")).status_code == 404
