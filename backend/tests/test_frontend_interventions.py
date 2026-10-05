from sqlalchemy import select

from app.models import CourseOffering, CourseTeacher, StudentProfile


def test_frequency_and_teacher_list_permissions(client, db, demo, school_b, auth_headers):
    headers = auth_headers("teacher")
    own = client.get("/api/v1/teacher/classes", headers=headers).json()[0]
    students = client.get(f"/api/v1/teacher/classes/{own['id']}/students", headers=headers).json()
    student = students[0]
    body = {
        "course_offering_id": own["id"],
        "title": "Weekly review",
        "start_date": "2026-02-02",
        "frequency": "Twice weekly",
        "visibility_to_student": True,
    }
    created = client.post(
        f"/api/v1/teacher/students/{student['id']}/interventions", headers=headers, json=body
    )
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["frequency"] == "Twice weekly"
    listing = client.get("/api/v1/teacher/interventions", headers=headers).json()
    assert [item["id"] for item in listing] == [row["id"]]
    assert (
        client.get("/api/v1/teacher/interventions", headers=auth_headers("student")).status_code
        == 403
    )
    other = auth_headers("teacher", "school-b")
    assert client.get("/api/v1/teacher/interventions", headers=other).json() == []
    assert (
        client.get(
            f"/api/v1/teacher/interventions?course_offering_id={own['id']}", headers=other
        ).status_code
        == 404
    )
    patched = client.patch(
        f"/api/v1/teacher/interventions/{row['id']}", headers=headers, json={"frequency": "Weekly"}
    )
    assert patched.json()["frequency"] == "Weekly"
    assert (
        client.patch(
            f"/api/v1/teacher/interventions/{row['id']}", headers=other, json={"frequency": "Daily"}
        ).status_code
        == 404
    )
    course = db.scalar(
        select(CourseOffering).where(CourseOffering.school_id != school_b["school"].id)
    )
    assignment = db.scalar(
        select(CourseTeacher).where(CourseTeacher.course_offering_id == course.id)
    )
    db.delete(assignment)
    db.flush()
    assert client.get("/api/v1/teacher/interventions", headers=headers).json() == []
    assert (
        client.get(f"/api/v1/teacher/interventions/{row['id']}", headers=headers).status_code == 404
    )


def test_frequency_validation(client, db, demo, auth_headers):
    student = db.scalar(select(StudentProfile))
    course = db.scalar(select(CourseOffering))
    response = client.post(
        f"/api/v1/teacher/students/{student.id}/interventions",
        headers=auth_headers("teacher"),
        json={
            "course_offering_id": str(course.id),
            "title": "Review",
            "start_date": "2026-02-02",
            "frequency": "a" * 201,
        },
    )
    assert response.status_code == 422
