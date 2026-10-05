from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.core.enums import InterventionStatus, InterventionUpdateKind, Role
from app.core.security import hash_password
from app.models import (
    AuditLog,
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    Intervention,
    InterventionTemplate,
    InterventionUpdate,
    StudentProfile,
    Subject,
    TeacherProfile,
    User,
    WeeklyRecord,
)
from app.services import intervention_service

BASE = "/api/v1/teacher"
SECOND_PASSWORD = "Second-Teacher-2026!"


def demo_course(db, school_id):
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == school_id))
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == school_id))
    return student, course


def add_history(db, school_id):
    student, course = demo_course(db, school_id)
    teacher = db.scalar(
        select(User).where(User.school_id == school_id, User.email == "teacher@demo.edu")
    )
    for i in range(5):
        db.add(
            WeeklyRecord(
                school_id=school_id,
                student_id=student.id,
                course_offering_id=course.id,
                week_start=date(2026, 1, 5) + timedelta(weeks=i),
                created_by=teacher.id,
                classes_held=10,
                classes_attended=9 - i,
                assessment_avg_score=80 - 10 * i,
                assignment_count=5,
                late_submissions=i,
            )
        )
    db.flush()
    return student, course


def run_prediction(client, headers, student, course):
    response = client.post(
        f"{BASE}/students/{student.id}/predictions",
        headers=headers,
        json={"course_offering_id": str(course.id), "as_of_date": "2026-02-02"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_intervention(client, headers, student, course, **overrides):
    body = {
        "course_offering_id": str(course.id),
        "title": "Weekly Mathematics Review",
        "start_date": "2026-02-02",
        "review_date": "2026-02-16",
        "visibility_to_student": True,
        "goal_definition": {"assessment_avg_score_target": 70, "attendance_target": 90},
    }
    body.update(overrides)
    return client.post(f"{BASE}/students/{student.id}/interventions", headers=headers, json=body)


def extra_course(db, school_id, teacher_profile_id):
    """A second course in the school, assigned to the given teacher profile."""
    classroom = db.scalar(
        select(Classroom).where(Classroom.school_id == school_id, Classroom.name == "Grade 10-B")
    )
    if classroom is None:
        classroom = Classroom(
            school_id=school_id, name="Grade 10-B", grade_label="10", academic_year="2026"
        )
        db.add(classroom)
        db.flush()
    subject = db.scalar(
        select(Subject).where(Subject.school_id == school_id, Subject.code == "PHY")
    )
    course = CourseOffering(
        school_id=school_id, classroom_id=classroom.id, subject_id=subject.id, academic_year="2026"
    )
    db.add(course)
    db.flush()
    db.add(
        CourseTeacher(
            school_id=school_id, teacher_id=teacher_profile_id, course_offering_id=course.id
        )
    )
    db.flush()
    return course


def second_student_with_own_course(db, school_id, teacher_profile_id=None):
    """Another student in the same school, enrolled in a course owned by `teacher_profile_id`."""
    if teacher_profile_id is None:
        teacher_profile_id = db.scalar(
            select(TeacherProfile).where(TeacherProfile.school_id == school_id)
        ).id
    user = User(
        school_id=school_id,
        email="student2@demo.edu",
        role=Role.STUDENT,
        password_hash=hash_password(SECOND_PASSWORD),
        first_name="Second",
        last_name="Student",
    )
    db.add(user)
    db.flush()
    profile = StudentProfile(
        school_id=school_id, user_id=user.id, roll_number="S002", grade_label="10"
    )
    db.add(profile)
    db.flush()
    course = extra_course(db, school_id, teacher_profile_id)
    db.add(
        Enrollment(
            school_id=school_id,
            student_id=profile.id,
            course_offering_id=course.id,
            enrolled_at=date(2026, 1, 1),
        )
    )
    teacher = db.scalar(
        select(User).where(User.school_id == school_id, User.email == "teacher@demo.edu")
    )
    for i in range(5):
        db.add(
            WeeklyRecord(
                school_id=school_id,
                student_id=profile.id,
                course_offering_id=course.id,
                week_start=date(2026, 1, 5) + timedelta(weeks=i),
                created_by=teacher.id,
                classes_held=10,
                classes_attended=9 - i,
                assessment_avg_score=80 - 10 * i,
                assignment_count=5,
                late_submissions=i,
            )
        )
    db.flush()
    return profile, course


def second_teacher_with_own_course(db, school_id):
    """A second teacher in the same school who owns a different course."""
    user = User(
        school_id=school_id,
        email="teacher2@demo.edu",
        role=Role.TEACHER,
        password_hash=hash_password(SECOND_PASSWORD),
        first_name="Second",
        last_name="Teacher",
    )
    db.add(user)
    db.flush()
    profile = TeacherProfile(school_id=school_id, user_id=user.id, employee_code="T002")
    db.add(profile)
    db.flush()
    return user, profile, extra_course(db, school_id, profile.id)


def login(client, email):
    response = client.post(
        "/api/v1/auth/login",
        json={"school_slug": "demo", "email": email, "password": SECOND_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_prediction_to_intervention_to_completion(client, db, demo, auth_headers):
    """Milestone 12 acceptance path: view prediction, act on it, follow up, complete."""
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    prediction = run_prediction(client, headers, student, course)
    suggested = prediction["recommendations"][0]
    created = create_intervention(
        client,
        headers,
        student,
        course,
        template_id=suggested["template_id"],
        prediction_id=prediction["id"],
    )
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["status"] == "planned"
    assert row["template_id"] == suggested["template_id"]
    assert row["prediction_id"] == prediction["id"]
    assert row["visibility_to_student"] is True
    assert row["goal_definition"] == {
        "assessment_avg_score_target": 70.0,
        "attendance_target": 90.0,
    }
    assert row["completed_at"] is None

    listed = client.get(f"{BASE}/students/{student.id}/interventions", headers=headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [row["id"]]

    single = client.get(f"{BASE}/interventions/{row['id']}", headers=headers)
    assert single.status_code == 200 and single.json()["title"] == row["title"]

    history = client.get(f"{BASE}/interventions/{row['id']}/updates", headers=headers)
    assert history.status_code == 200
    assert [u["kind"] for u in history.json()] == ["created"]
    assert history.json()[0]["details"]["prediction_id"] == prediction["id"]

    activated = client.patch(
        f"{BASE}/interventions/{row['id']}", headers=headers, json={"status": "active"}
    )
    assert activated.status_code == 200 and activated.json()["status"] == "active"

    note = client.post(
        f"{BASE}/interventions/{row['id']}/updates",
        headers=headers,
        json={"note": "Reviewed progress with the student."},
    )
    assert note.status_code == 201 and note.json()["kind"] == "note"

    completed = client.post(f"{BASE}/interventions/{row['id']}/complete", headers=headers)
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None

    kinds = [
        u["kind"]
        for u in client.get(f"{BASE}/interventions/{row['id']}/updates", headers=headers).json()
    ]
    assert kinds == ["created", "status_change", "note", "completed"]

    stored = db.get(Intervention, UUID(row["id"]))
    assert stored.status == InterventionStatus.COMPLETED
    assert stored.completed_at is not None
    assert db.scalar(select(User).where(User.email == "teacher@demo.edu")).id == stored.created_by
    actions = set(db.scalars(select(AuditLog.action).where(AuditLog.entity_id == stored.id)).all())
    assert {"intervention.created", "intervention.updated", "intervention.completed"} <= actions


def test_intervention_permissions_roles_tenants_and_revoked_assignment(
    client, db, demo, school_b, auth_headers
):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    created = create_intervention(client, headers, student, course)
    assert created.status_code == 201
    path = f"{BASE}/interventions/{created.json()['id']}"

    for role in ("admin", "student"):
        assert client.get(path, headers=auth_headers(role)).status_code == 403
        assert create_intervention(client, auth_headers(role), student, course).status_code == 403
        assert client.post(f"{path}/complete", headers=auth_headers(role)).status_code == 403
        assert (
            client.post(
                f"{path}/updates", headers=auth_headers(role), json={"note": "x"}
            ).status_code
            == 403
        )

    outsider = auth_headers("teacher", "school-b")
    assert client.get(path, headers=outsider).status_code == 404
    assert client.patch(path, headers=outsider, json={"title": "Hijacked"}).status_code == 404
    assert client.post(f"{path}/complete", headers=outsider).status_code == 404
    assert client.post(f"{path}/updates", headers=outsider, json={"note": "x"}).status_code == 404
    assert client.get(f"{path}/updates", headers=outsider).status_code == 404
    assert (
        client.get(f"{BASE}/students/{student.id}/interventions", headers=outsider).status_code
        == 404
    )
    assert (
        create_intervention(
            client, outsider, school_b["student_profile"], school_b["course"]
        ).status_code
        == 201
    )

    db.delete(db.scalar(select(CourseTeacher).where(CourseTeacher.course_offering_id == course.id)))
    # Commit the administrative change so the next request's rollback cannot restore it.
    db.commit()
    assert client.get(path, headers=headers).status_code == 404
    assert client.patch(path, headers=headers, json={"title": "Nope"}).status_code == 404
    assert client.post(f"{path}/complete", headers=headers).status_code == 404
    assert client.get(f"{path}/updates", headers=headers).status_code == 404
    assert (
        create_intervention(client, headers, student, course, title="After revocation").status_code
        == 404
    )


def test_intervention_list_is_scoped_to_the_teachers_own_courses(client, db, demo, auth_headers):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    created = create_intervention(client, headers, student, course)
    assert created.status_code == 201
    other_user, other_profile, other_course = second_teacher_with_own_course(db, demo.id)
    other_headers = login(client, other_user.email)

    # Another teacher in the same school cannot reach a student outside their courses.
    assert (
        client.get(f"{BASE}/students/{student.id}/interventions", headers=other_headers).status_code
        == 404
    )
    assert (
        client.get(
            f"{BASE}/students/{student.id}/interventions",
            headers=other_headers,
            params={"course_offering_id": str(other_course.id)},
        ).status_code
        == 404
    )
    # A teacher who legitimately reaches a student with no interventions sees an empty list.
    reachable, _ = second_student_with_own_course(db, demo.id, other_profile.id)
    reachable_list = client.get(
        f"{BASE}/students/{reachable.id}/interventions", headers=other_headers
    )
    assert reachable_list.status_code == 200
    assert reachable_list.json() == []
    mine = client.get(f"{BASE}/students/{student.id}/interventions", headers=headers).json()
    assert [row["id"] for row in mine] == [created.json()["id"]]
    assert (
        client.get(
            f"{BASE}/students/{student.id}/interventions",
            headers=headers,
            params={"status": "completed"},
        ).json()
        == []
    )
    assert (
        len(
            client.get(
                f"{BASE}/students/{student.id}/interventions",
                headers=headers,
                params={"status": "planned"},
            ).json()
        )
        == 1
    )
    assert (
        client.get(
            f"{BASE}/students/{student.id}/interventions",
            headers=headers,
            params={"status": "not-a-status"},
        ).status_code
        == 422
    )


def test_create_rejects_foreign_references_and_invalid_input(
    client, db, demo, school_b, auth_headers
):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    prediction = run_prediction(client, headers, student, course)

    school_b_template = client.post(
        "/api/v1/admin/intervention-templates",
        headers=auth_headers("admin", "school-b"),
        json={"name": "B only plan", "description": "School B", "tags": {"attendance": 1}},
    )
    assert school_b_template.status_code == 201
    foreign = create_intervention(
        client, headers, student, course, template_id=school_b_template.json()["id"]
    )
    assert foreign.status_code == 422
    assert foreign.json()["error"]["code"] == "INVALID_TEMPLATE"

    unknown = create_intervention(client, headers, student, course, prediction_id=str(uuid4()))
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "INVALID_PREDICTION"

    # A real prediction belonging to another student/course cannot be borrowed.
    other_student, other_course = second_student_with_own_course(db, demo.id)
    other_prediction = run_prediction(client, headers, other_student, other_course)
    borrowed = create_intervention(
        client, headers, student, course, prediction_id=other_prediction["id"]
    )
    assert borrowed.status_code == 422
    assert borrowed.json()["error"]["code"] == "INVALID_PREDICTION"

    # The same student is not enrolled in a course this teacher does not own.
    _, _, unowned_course = second_teacher_with_own_course(db, demo.id)
    unowned = client.post(
        f"{BASE}/students/{student.id}/interventions",
        headers=headers,
        json={
            "course_offering_id": str(unowned_course.id),
            "title": "Physics support",
            "start_date": "2026-02-02",
        },
    )
    assert unowned.status_code == 404

    for body, code in [
        ({"title": "Backwards", "review_date": "2026-01-01"}, "VALIDATION_ERROR"),
        ({"status": "completed"}, "VALIDATION_ERROR"),
        ({"goal_definition": {"motivation_target": 5}}, "VALIDATION_ERROR"),
        ({"goal_definition": {"attendance_target": 140}}, "VALIDATION_ERROR"),
        ({"visibility_to_student": "yes please"}, "VALIDATION_ERROR"),
    ]:
        response = client.post(
            f"{BASE}/students/{student.id}/interventions",
            headers=headers,
            json={"course_offering_id": str(course.id), "start_date": "2026-02-02", **body},
        )
        assert response.status_code == 422, (body, response.text)
        assert response.json()["error"]["code"] == code

    assert (
        create_intervention(client, headers, student, course, student_id=str(uuid4())).status_code
        == 422
    )
    assert db.scalar(select(func.count()).select_from(Intervention)) == 0
    assert db.scalar(select(func.count()).select_from(InterventionUpdate)) == 0
    assert prediction["risk_probability"] >= 0


def test_status_transitions_and_completion_conflicts(client, db, demo, auth_headers):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    row = create_intervention(client, headers, student, course).json()
    path = f"{BASE}/interventions/{row['id']}"

    assert client.patch(path, headers=headers, json={"status": "cancelled"}).status_code == 200
    assert client.patch(path, headers=headers, json={"status": "active"}).status_code == 422
    assert client.post(f"{path}/complete", headers=headers).status_code == 422

    other = create_intervention(client, headers, student, course, title="Second plan").json()
    other_path = f"{BASE}/interventions/{other['id']}"
    assert client.post(f"{other_path}/complete", headers=headers).json()["status"] == "completed"
    assert client.post(f"{other_path}/complete", headers=headers).status_code == 409
    assert client.post(f"{other_path}/complete", headers=headers).json()["error"]["code"] == (
        "ALREADY_COMPLETED"
    )
    assert client.patch(other_path, headers=headers, json={"status": "active"}).status_code == 422
    assert (
        client.patch(other_path, headers=headers, json={"status": "completed"}).status_code == 422
    )
    # Notes remain possible after completion so late observations are not lost.
    assert (
        client.post(
            f"{other_path}/updates", headers=headers, json={"note": "Late note"}
        ).status_code
        == 201
    )

    assert client.patch(path, headers=headers, json={}).status_code == 422
    assert client.patch(path, headers=headers, json={"title": None}).status_code == 422
    assert client.patch(path, headers=headers, json={"title": ""}).status_code == 422
    assert (
        client.patch(path, headers=headers, json={"review_date": "2026-01-05"}).status_code == 422
    )


def test_patch_preserves_untouched_fields_and_cannot_move_the_student(
    client, db, demo, auth_headers
):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    row = create_intervention(client, headers, student, course).json()
    path = f"{BASE}/interventions/{row['id']}"

    patched = client.patch(
        path,
        headers=headers,
        json={"title": "Renamed plan", "goal_definition": {"attendance_target": 95}},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "Renamed plan"
    assert body["goal_definition"] == {"attendance_target": 95.0}
    assert body["start_date"] == row["start_date"]
    assert body["review_date"] == row["review_date"]
    assert body["student_id"] == row["student_id"]
    assert body["course_offering_id"] == row["course_offering_id"]
    assert body["visibility_to_student"] is True

    for injected in [
        {"student_id": str(uuid4())},
        {"course_offering_id": str(uuid4())},
        {"school_id": str(uuid4())},
        {"prediction_id": str(uuid4())},
        {"completed_at": "2026-02-20T00:00:00Z"},
        {"created_by": str(uuid4())},
    ]:
        assert client.patch(path, headers=headers, json=injected).status_code == 422, injected
    assert client.get(path, headers=headers).json()["student_id"] == row["student_id"]


def test_create_rolls_back_the_initial_update_when_it_fails(
    client, db, demo, auth_headers, monkeypatch
):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)

    def broken(*args, **kwargs):
        raise RuntimeError("update write failed")

    monkeypatch.setattr(intervention_service, "append_update", broken)
    with pytest.raises(RuntimeError):
        create_intervention(client, headers, student, course)
    assert db.scalar(select(func.count()).select_from(Intervention)) == 0
    assert db.scalar(select(func.count()).select_from(InterventionUpdate)) == 0
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action == "intervention.created")
        )
        == 0
    )

    # The same request succeeds once the fault is removed.
    monkeypatch.undo()
    assert create_intervention(client, headers, student, course).status_code == 201


def test_intervention_updates_are_tenant_scoped_and_paginated(client, db, demo, auth_headers):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    row = create_intervention(client, headers, student, course).json()
    path = f"{BASE}/interventions/{row['id']}"
    for index in range(5):
        assert (
            client.post(
                f"{path}/updates", headers=headers, json={"note": f"Note {index}"}
            ).status_code
            == 201
        )
    page = client.get(f"{path}/updates", headers=headers, params={"limit": 2, "offset": 1})
    assert page.status_code == 200
    # The created entry occupies sequence 1, so offset 1 starts at the first note.
    assert [u["note"] for u in page.json()] == ["Note 0", "Note 1"]
    assert [u["sequence"] for u in page.json()] == [2, 3]
    assert all(u["kind"] == InterventionUpdateKind.NOTE.value for u in page.json())
    stored = db.scalars(
        select(InterventionUpdate)
        .where(InterventionUpdate.intervention_id == UUID(row["id"]))
        .order_by(InterventionUpdate.sequence)
    ).all()
    assert len(stored) == 6
    assert [u.sequence for u in stored] == [1, 2, 3, 4, 5, 6]
    assert {u.school_id for u in stored} == {demo.id}
    blank = client.post(f"{path}/updates", headers=headers, json={"note": "   "})
    assert blank.status_code == 422
    assert client.get(f"{path}/updates", headers=headers, params={"limit": 0}).status_code == 422


def test_default_templates_can_be_selected_as_intervention_templates(
    client, db, demo, auth_headers
):
    headers = auth_headers("teacher")
    student, course = add_history(db, demo.id)
    default = db.scalar(
        select(InterventionTemplate).where(InterventionTemplate.school_id.is_(None))
    )
    assert default is not None
    created = create_intervention(client, headers, student, course, template_id=str(default.id))
    assert created.status_code == 201
    assert created.json()["template_id"] == str(default.id)
