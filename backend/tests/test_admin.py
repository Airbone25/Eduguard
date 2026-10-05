from sqlalchemy import func, select

from app.models import AuditLog, CourseOffering, StudentProfile, TeacherProfile, User


def test_admin_complete_school_workflow(client, db, auth_headers):
    headers = auth_headers()

    def post(path, data):
        response = client.post("/api/v1/admin/" + path, headers=headers, json=data)
        assert response.status_code == 201, response.text
        return response.json()

    identity = {"first_name": "New", "last_name": "Person", "password": "Secure-School-2026!"}
    teacher = post("teachers", {**identity, "email": "newteacher@demo.edu"})
    student = post(
        "students",
        {**identity, "email": "newstudent@demo.edu", "roll_number": "NEW1", "grade_label": "11"},
    )
    classroom = post("classes", {"name": "11-B", "grade_label": "11", "academic_year": "2026"})
    subject = post("subjects", {"name": "History", "code": "HIST"})
    course = post(
        "course-offerings",
        {"classroom_id": classroom["id"], "subject_id": subject["id"], "academic_year": "2026"},
    )
    post(f"course-offerings/{course['id']}/teachers", {"teacher_id": teacher["id"]})
    post(
        f"course-offerings/{course['id']}/students",
        {"student_id": student["id"], "enrolled_at": "2026-01-01"},
    )
    changed = client.patch(
        f"/api/v1/admin/users/{student['user_id']}", headers=headers, json={"first_name": "Updated"}
    )
    assert changed.status_code == 200
    assert changed.json()["first_name"] == "Updated"
    for resource in ["users", "classes", "subjects", "course-offerings"]:
        response = client.get(f"/api/v1/admin/{resource}", headers=headers)
        assert response.status_code == 200
        assert all(row["school_id"] == course["school_id"] for row in response.json())
        assert "password" not in response.text
    logs = db.scalars(select(AuditLog)).all()
    assert len(logs) == 8
    assert "Secure-School" not in str([log.details for log in logs])


def test_admin_denies_other_roles_and_tenant_injection(client, auth_headers):
    for role in ["teacher", "student"]:
        headers = auth_headers(role)
        assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
        assert (
            client.post(
                "/api/v1/admin/subjects", headers=headers, json={"code": "HIST", "name": "History"}
            ).status_code
            == 403
        )
    headers = auth_headers()
    assert (
        client.post(
            "/api/v1/admin/subjects",
            headers=headers,
            json={"code": "X", "name": "X", "school_id": "spoof"},
        ).status_code
        == 422
    )


def test_admin_cross_tenant_lists_and_references(client, db, demo, school_b, auth_headers):
    headers = auth_headers()
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    for resource in ["users", "classes", "subjects", "course-offerings"]:
        data = client.get(f"/api/v1/admin/{resource}", headers=headers).json()
        assert all(row["school_id"] == str(demo.id) for row in data)
    assert (
        client.patch(
            f"/api/v1/admin/users/{school_b['student'].id}",
            headers=headers,
            json={"is_active": False},
        ).status_code
        == 404
    )
    for resource, body in [
        ("teachers", {"teacher_id": str(school_b["teacher_profile"].id)}),
        (
            "students",
            {"student_id": str(school_b["student_profile"].id), "enrolled_at": "2026-01-01"},
        ),
    ]:
        assert (
            client.post(
                f"/api/v1/admin/course-offerings/{course.id}/{resource}", headers=headers, json=body
            ).status_code
            == 404
        )
    assert (
        client.post(
            "/api/v1/admin/course-offerings",
            headers=headers,
            json={
                "classroom_id": str(school_b["classroom"].id),
                "subject_id": str(school_b["subject"].id),
                "academic_year": "2026",
            },
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/admin/course-offerings/{school_b['course'].id}/teachers",
            headers=headers,
            json={
                "teacher_id": str(
                    db.scalar(select(TeacherProfile).where(TeacherProfile.school_id == demo.id)).id
                )
            },
        ).status_code
        == 404
    )


def test_duplicate_roll_rolls_back_user_and_audit(client, db, auth_headers):
    headers = auth_headers()
    count = db.scalar(select(func.count()).select_from(User))
    response = client.post(
        "/api/v1/admin/students",
        headers=headers,
        json={
            "email": "duplicate@demo.edu",
            "password": "Secure-School-2026!",
            "first_name": "Duplicate",
            "last_name": "Student",
            "roll_number": "S001",
            "grade_label": "10",
        },
    )
    assert response.status_code == 409
    assert db.scalar(select(func.count()).select_from(User)) == count
    assert db.scalar(select(func.count()).select_from(AuditLog)) == 0


def test_admin_deactivation_revokes_sessions_and_rejects_role_changes(client, db, auth_headers):
    teacher_headers = auth_headers("teacher")
    admin_headers = auth_headers()
    teacher = db.scalar(select(TeacherProfile))
    path = f"/api/v1/admin/users/{teacher.user_id}"
    assert (
        client.patch(path, headers=admin_headers, json={"role": "school_admin"}).status_code == 422
    )
    assert client.patch(path, headers=admin_headers, json={"email": None}).status_code == 422
    assert client.patch(path, headers=admin_headers, json={"is_active": False}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=teacher_headers).status_code == 401
    assert client.patch(path, headers=admin_headers, json={"is_active": True}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=teacher_headers).status_code == 401


def test_duplicate_assignment_and_enrollment_conflict(client, db, auth_headers):
    headers = auth_headers()
    course = db.scalar(select(CourseOffering))
    for path, body in [
        ("teachers", {"teacher_id": str(db.scalar(select(TeacherProfile)).id)}),
        (
            "students",
            {"student_id": str(db.scalar(select(StudentProfile)).id), "enrolled_at": "2026-01-01"},
        ),
    ]:
        assert (
            client.post(
                f"/api/v1/admin/course-offerings/{course.id}/{path}", headers=headers, json=body
            ).status_code
            == 409
        )
