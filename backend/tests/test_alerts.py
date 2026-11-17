from datetime import date, timedelta

from sqlalchemy import select

from app.core.enums import Role
from app.models import (
    CourseOffering,
    Enrollment,
    Intervention,
    RiskPrediction,
    StudentProfile,
    User,
    WeeklyRecord,
)


def seed_student(db, demo, name, attended=9, score=90, weeks=5):
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    teacher = db.scalar(select(User).where(User.school_id == demo.id, User.role == Role.TEACHER))
    user = User(
        school_id=demo.id,
        role=Role.STUDENT,
        email=f"{name}@demo.edu",
        first_name=name,
        last_name="Test",
        password_hash=teacher.password_hash,
    )
    db.add(user)
    db.flush()
    student = StudentProfile(school_id=demo.id, user_id=user.id, roll_number=name, grade_label="10")
    db.add(student)
    db.flush()
    db.add(
        Enrollment(
            school_id=demo.id,
            student_id=student.id,
            course_offering_id=course.id,
            enrolled_at=date(2026, 1, 1),
        )
    )
    for i in range(weeks):
        db.add(
            WeeklyRecord(
                school_id=demo.id,
                student_id=student.id,
                course_offering_id=course.id,
                week_start=date(2026, 1, 5) + timedelta(weeks=i),
                created_by=teacher.id,
                classes_held=10,
                classes_attended=attended,
                assessment_avg_score=score,
            )
        )
    db.flush()
    return course, teacher, student


def predict(client, headers, student, course, as_of):
    response = client.post(
        f"/api/v1/teacher/students/{student.id}/predictions",
        headers=headers,
        json={"course_offering_id": str(course.id), "as_of_date": as_of},
    )
    assert response.status_code == 201, response.text
    return response.json()


def force(db, prediction_id, probability, at_risk, level):
    row = db.get(RiskPrediction, prediction_id)
    row.risk_probability = probability
    row.at_risk = at_risk
    row.risk_level = level


def test_alert_feed_kinds_ordering_and_counts(client, db, demo, auth_headers):
    course, teacher, aaron = seed_student(db, demo, "Aaron")
    _, _, zoe = seed_student(db, demo, "Zoe", attended=4, score=45)
    _, _, mia = seed_student(db, demo, "Mia")
    _, _, sam = seed_student(db, demo, "Sam")
    headers = auth_headers("teacher")

    low = predict(client, headers, aaron, course, "2026-02-02")
    rising = predict(client, headers, aaron, course, "2026-02-09")
    force(db, low["id"], 0.5, False, "medium")
    force(db, rising["id"], 0.9, True, "high")

    zoe_alert = predict(client, headers, zoe, course, "2026-02-02")
    force(db, zoe_alert["id"], 0.8, True, "high")

    mia_low = predict(client, headers, mia, course, "2026-02-02")
    mia_high = predict(client, headers, mia, course, "2026-02-09")
    force(db, mia_low["id"], 0.8, True, "high")
    force(db, mia_high["id"], 0.4, False, "low")

    sam_alert = predict(client, headers, sam, course, "2026-02-09")
    force(db, sam_alert["id"], 0.3, False, "low")
    db.add(
        WeeklyRecord(
            school_id=demo.id,
            student_id=sam.id,
            course_offering_id=course.id,
            week_start=date(2026, 2, 16),
            created_by=teacher.id,
            classes_held=10,
            classes_attended=9,
            assessment_avg_score=90,
        )
    )
    db.flush()

    result = client.get(
        "/api/v1/teacher/alerts", headers=headers, params={"as_of_date": "2026-02-09"}
    )
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["counts"] == {
        "total": 4,
        "declining": 1,
        "needs_support": 1,
        "new_data": 1,
        "improving": 1,
    }
    kinds = [a["kind"] for a in data["alerts"]]
    assert kinds == ["declining", "needs_support", "new_data", "improving"]
    by_kind = dict(zip(kinds, data["alerts"], strict=True))
    declining = by_kind["declining"]
    assert declining["student_id"] == str(aaron.id)
    assert declining["previous_probability"] == 0.5
    assert declining["probability_delta"] == 0.4
    assert declining["at_risk"] and declining["active_intervention"] is False
    assert declining["support_level"] == "priority_support"
    assert declining["course"]["id"] == str(course.id)
    assert " · " in declining["course_label"]
    assert by_kind["needs_support"]["student_id"] == str(zoe.id)
    assert by_kind["needs_support"]["previous_probability"] is None
    assert by_kind["new_data"]["student_id"] == str(sam.id)
    assert by_kind["improving"]["student_id"] == str(mia.id)
    assert by_kind["improving"]["probability_delta"] == -0.4

    db.add(
        Intervention(
            school_id=demo.id,
            student_id=zoe.id,
            course_offering_id=course.id,
            title="Check-in",
            start_date=date(2026, 2, 2),
            created_by=teacher.id,
        )
    )
    db.flush()
    supported = client.get(
        "/api/v1/teacher/alerts", headers=headers, params={"as_of_date": "2026-02-09"}
    ).json()
    assert supported["counts"]["needs_support"] == 0
    assert supported["counts"]["total"] == 3
    assert supported["alerts"][0]["kind"] == "declining"


def test_alert_feed_pagination_and_as_of(client, db, demo, auth_headers):
    course, _, aaron = seed_student(db, demo, "Aaron")
    _, _, zoe = seed_student(db, demo, "Zoe", attended=4, score=45)
    headers = auth_headers("teacher")
    aaron_alert = predict(client, headers, aaron, course, "2026-02-02")
    force(db, aaron_alert["id"], 0.8, True, "high")
    zoe_alert = predict(client, headers, zoe, course, "2026-02-02")
    force(db, zoe_alert["id"], 0.8, True, "high")

    first = client.get("/api/v1/teacher/alerts", headers=headers, params={"limit": 1, "offset": 0})
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["counts"]["total"] == 2
    assert len(body["alerts"]) == 1
    second = client.get(
        "/api/v1/teacher/alerts", headers=headers, params={"limit": 1, "offset": 1}
    ).json()
    assert second["alerts"][0]["student_id"] != body["alerts"][0]["student_id"]
    # Predictions dated after the requested as_of date are excluded.
    empty = client.get(
        "/api/v1/teacher/alerts", headers=headers, params={"as_of_date": "2026-01-31"}
    ).json()
    assert empty["alerts"] == [] and empty["counts"]["total"] == 0


def test_alert_feed_tenant_and_role_isolation(client, db, demo, school_b, auth_headers):
    course, _, aaron = seed_student(db, demo, "Aaron", attended=3, score=40)
    headers = auth_headers("teacher")
    prediction = predict(client, headers, aaron, course, "2026-02-02")
    force(db, prediction["id"], 0.85, True, "high")
    for role in ("student", "admin"):
        assert client.get("/api/v1/teacher/alerts", headers=auth_headers(role)).status_code == 403
    other = client.get("/api/v1/teacher/alerts", headers=auth_headers("teacher", "school-b"))
    assert other.status_code == 200
    assert other.json()["counts"]["total"] == 0
    assert other.json()["alerts"] == []
