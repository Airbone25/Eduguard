from sqlalchemy import select

from app.core.enums import EnrollmentStatus
from app.models import CourseOffering, CourseTeacher, Enrollment, StudentProfile


def test_teacher_routes_assigned_and_cross_school(client, db, demo, school_b, auth_headers):
    headers = auth_headers("teacher")
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    classes = client.get("/api/v1/teacher/classes", headers=headers)
    assert classes.status_code == 200
    assert [row["id"] for row in classes.json()] == [str(course.id)]
    students = client.get(f"/api/v1/teacher/classes/{course.id}/students", headers=headers)
    assert students.status_code == 200
    assert [row["id"] for row in students.json()] == [str(student.id)]
    assert client.get(f"/api/v1/teacher/students/{student.id}", headers=headers).status_code == 200
    assert (
        client.get(
            f"/api/v1/teacher/students/{school_b['student_profile'].id}", headers=headers
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/teacher/classes/{school_b['course'].id}/students", headers=headers
        ).status_code
        == 404
    )
    assert "guardian_contact" not in students.text and "password_hash" not in students.text


def test_teacher_unassigned_and_inactive_enrollment(client, db, auth_headers):
    headers = auth_headers("teacher")
    course, student = db.scalar(select(CourseOffering)), db.scalar(select(StudentProfile))
    db.scalar(select(Enrollment)).status = EnrollmentStatus.WITHDRAWN
    db.flush()
    assert client.get(f"/api/v1/teacher/classes/{course.id}/students", headers=headers).json() == []
    assert client.get(f"/api/v1/teacher/students/{student.id}", headers=headers).status_code == 404
    db.delete(db.scalar(select(CourseTeacher)))
    db.flush()
    assert client.get("/api/v1/teacher/classes", headers=headers).json() == []
    assert (
        client.get(f"/api/v1/teacher/classes/{course.id}/students", headers=headers).status_code
        == 404
    )


def test_teacher_routes_reject_admin_and_student(client, auth_headers):
    for role in ("admin", "student"):
        assert client.get("/api/v1/teacher/classes", headers=auth_headers(role)).status_code == 403
