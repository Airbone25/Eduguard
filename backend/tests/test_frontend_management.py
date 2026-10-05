from datetime import date, timedelta

from sqlalchemy import select

from app.models import CourseOffering, Enrollment, StudentProfile, WeeklyRecord


def test_management_is_tenant_scoped_and_admin_only(client, db, demo, school_b, auth_headers):
    admin = auth_headers()
    other = auth_headers("admin", "school-b")
    teacher = auth_headers("teacher")
    student = auth_headers("student")
    course = client.get("/api/v1/admin/course-offerings", headers=admin).json()[0]
    cid = course["id"]
    reads = [
        "teachers",
        "students",
        "settings",
        f"course-offerings/{cid}/teachers",
        f"course-offerings/{cid}/students",
    ]
    for path in reads:
        assert client.get(f"/api/v1/admin/{path}", headers=admin).status_code == 200
        for h in [teacher, student]:
            assert client.get(f"/api/v1/admin/{path}", headers=h).status_code == 403
    for path in ["teachers", "students"]:
        assert all(
            r["school_id"] == str(school_b["school"].id)
            for r in client.get(f"/api/v1/admin/{path}", headers=other).json()
        )
    assert client.get("/api/v1/admin/settings", headers=other).json()["name"] == "School B"
    for kind in ["teachers", "students"]:
        assert (
            client.get(f"/api/v1/admin/course-offerings/{cid}/{kind}", headers=other).status_code
            == 404
        )
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.course_offering_id == CourseOffering.id, CourseOffering.id == cid
        )
    )
    edits = [
        (f"classes/{course['classroom_id']}", {"name": "Updated"}),
        (f"subjects/{course['subject_id']}", {"name": "Renamed"}),
        (f"course-offerings/{cid}", {"is_active": True}),
        (f"enrollments/{enrollment.id}", {"status": "withdrawn"}),
    ]
    for path, body in edits:
        for h, code in [(other, 404), (teacher, 403), (student, 403), (admin, 200)]:
            response = client.patch(f"/api/v1/admin/{path}", headers=h, json=body)
            assert response.status_code == code, response.text
    assignment = client.get(f"/api/v1/admin/course-offerings/{cid}/teachers", headers=admin).json()[
        0
    ]
    url = f"/api/v1/admin/course-offerings/{cid}/teachers/{assignment['teacher_id']}"
    for h, code in [(other, 404), (teacher, 403), (student, 403), (admin, 204)]:
        assert client.delete(url, headers=h).status_code == code
    assert client.get("/api/v1/teacher/classes", headers=teacher).json() == []
    assert (
        client.patch(
            "/api/v1/admin/settings", headers=other, json={"name": "New School B"}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/admin/settings", headers=admin).json()["name"] != "New School B"
    for h in [teacher, student]:
        assert (
            client.patch("/api/v1/admin/settings", headers=h, json={"name": "Bad"}).status_code
            == 403
        )


def test_management_validation_and_enrollment_restore(client, demo, auth_headers):
    headers = auth_headers()
    course = client.get("/api/v1/admin/course-offerings", headers=headers).json()[0]
    url = f"/api/v1/admin/course-offerings/{course['id']}"
    for body in [{}, {"is_active": None}, {"school_id": "bad"}]:
        assert client.patch(url, headers=headers, json=body).status_code == 422
    enrollment = client.get(url + "/students", headers=headers).json()[0]
    member = f"/api/v1/admin/enrollments/{enrollment['id']}"
    assert client.patch(member, headers=headers, json={"status": "withdrawn"}).status_code == 200
    assert client.patch(url, headers=headers, json={"is_active": False}).status_code == 200
    assert client.patch(member, headers=headers, json={"status": "active"}).status_code == 422
    assert client.patch(url, headers=headers, json={"is_active": True}).status_code == 200
    assert client.patch(member, headers=headers, json={"status": "active"}).status_code == 200


def test_extended_student_history_remains_private_and_bounded(client, db, demo, auth_headers):
    student = db.scalar(select(StudentProfile))
    course = db.scalar(select(CourseOffering))
    anchor = date(2026, 9, 28)
    for delta in [0, 4, 10, -1, 53]:
        db.add(
            WeeklyRecord(
                school_id=student.school_id,
                student_id=student.id,
                course_offering_id=course.id,
                week_start=anchor - timedelta(weeks=delta),
                classes_held=5,
                classes_attended=4,
                assessment_avg_score=70,
                created_by=student.user_id,
            )
        )
    db.flush()
    headers = auth_headers("student")
    url = "/api/v1/student/me/progress?as_of_date=2026-10-03"
    short = client.get(url, headers=headers)
    long = client.get(url + "&history_weeks=52", headers=headers)
    assert short.status_code == long.status_code == 200, long.text
    assert len(short.json()["courses"][0]["weeks"]) == 2
    assert len(long.json()["courses"][0]["weeks"]) == 3
    assert short.json()["courses"][0]["academic"] == long.json()["courses"][0]["academic"]
    for forbidden in ["risk_probability", "at_risk", "signals", "private_notes", "entered_by"]:
        assert forbidden not in long.text
    assert client.get(url + "&history_weeks=53", headers=headers).status_code == 422
    assert client.get(url + "&history_weeks=0", headers=headers).status_code == 422


def test_teacher_courses_have_readable_labels(client, demo, auth_headers):
    result = client.get("/api/v1/teacher/classes", headers=auth_headers("teacher"))
    assert result.status_code == 200
    assert result.json()[0]["classroom_name"]
    assert result.json()[0]["subject_name"]
