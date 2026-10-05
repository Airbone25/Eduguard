from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.core.enums import Role
from app.models import (
    CourseOffering,
    CourseTeacher,
    Enrollment,
    Intervention,
    RiskPrediction,
    StudentProfile,
    User,
    WeeklyRecord,
)
from app.services.progress_metrics import metric_trend, trajectory


def roster(db, demo):
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    teacher = db.scalar(select(User).where(User.school_id == demo.id, User.role == Role.TEACHER))
    original = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    students = [original]
    for name in ("Aaron", "Zoe"):
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
        student = StudentProfile(
            school_id=demo.id, user_id=user.id, roll_number=name, grade_label="10"
        )
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
        students.append(student)
    for student, attended, score in [(students[0], 5, 40), (students[1], 9, 90)]:
        for i in range(6):
            db.add(
                WeeklyRecord(
                    school_id=demo.id,
                    student_id=student.id,
                    course_offering_id=course.id,
                    week_start=date(2026, 1, 5) + timedelta(weeks=i),
                    created_by=teacher.id,
                    classes_held=10,
                    classes_attended=attended if i == 5 else 9,
                    assessment_avg_score=score if i == 5 else 90,
                )
            )
    db.flush()
    return course, teacher, students


def test_summary_counts_sorting_dates_and_pagination(client, db, demo, auth_headers):
    course, teacher, students = roster(db, demo)
    headers = auth_headers("teacher")
    body = {"course_offering_id": str(course.id), "as_of_date": "2026-02-09"}
    assert (
        client.post(
            f"/api/v1/teacher/students/{students[0].id}/predictions", headers=headers, json=body
        ).status_code
        == 201
    )
    prediction = db.scalar(select(RiskPrediction))
    prediction.risk_level = "high"
    prediction.risk_probability = 0.9
    prediction.at_risk = True
    db.add(
        Intervention(
            school_id=demo.id,
            student_id=students[0].id,
            course_offering_id=course.id,
            title="Review",
            start_date=date(2026, 2, 9),
            created_by=teacher.id,
        )
    )
    # A later raw row and later prediction must not change the earlier dashboard.
    db.add(
        WeeklyRecord(
            school_id=demo.id,
            student_id=students[0].id,
            course_offering_id=course.id,
            week_start=date(2026, 2, 16),
            created_by=teacher.id,
            classes_held=10,
            classes_attended=10,
            assessment_avg_score=100,
        )
    )
    db.flush()
    assert (
        client.post(
            f"/api/v1/teacher/students/{students[0].id}/predictions",
            headers=headers,
            json={**body, "as_of_date": "2026-02-16"},
        ).status_code
        == 201
    )
    path = f"/api/v1/teacher/classes/{course.id}/risk-summary"
    params = {"as_of_date": "2026-02-09"}
    result = client.get(path, headers=headers, params=params)
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["counts"] == {
        "students": 3,
        "priority_support": 1,
        "watch": 0,
        "doing_well": 0,
        "not_assessed": 2,
        "newly_declining": 1,
    }
    first = data["students"][0]
    assert first["student_id"] == str(students[0].id)
    assert first["attendance"] == 50 and first["latest_score"] == 40
    assert first["trajectory"] == "declining" and first["active_intervention"]
    assert first["top_signal"] and first["prediction_as_of_date"] == "2026-02-09"
    for mode, expected in [
        ("name", students[1]),
        ("attendance", students[0]),
        ("score", students[0]),
        ("attention", students[0]),
    ]:
        page = client.get(path, headers=headers, params={**params, "sort": mode, "limit": 1}).json()
        assert page["students"][0]["student_id"] == str(expected.id)
        assert page["counts"] == data["counts"]
    assert (
        client.get(path, headers=headers, params={**params, "offset": 3}).json()["students"] == []
    )
    assert client.get(path, headers=headers, params={"sort": "probability"}).status_code == 422


def test_summary_permissions_and_inactive_roster(client, db, demo, school_b, auth_headers):
    course, teacher, students = roster(db, demo)
    path = f"/api/v1/teacher/classes/{course.id}/risk-summary"
    for role in ("student", "admin"):
        assert client.get(path, headers=auth_headers(role)).status_code == 403
    assert client.get(path, headers=auth_headers("teacher", "school-b")).status_code == 404
    headers = auth_headers("teacher")
    db.get(User, students[1].user_id).is_active = False
    db.scalar(select(Enrollment).where(Enrollment.student_id == students[2].id)).enrolled_at = date(
        2099, 1, 1
    )
    db.flush()
    assert client.get(path, headers=headers).json()["counts"]["students"] == 1
    db.delete(db.scalar(select(CourseTeacher).where(CourseTeacher.course_offering_id == course.id)))
    db.flush()
    assert client.get(path, headers=headers).status_code == 404


@pytest.mark.parametrize(
    "change,expected",
    [(None, "insufficient_history"), (-8, "declining"), (8, "improving"), (1, "stable")],
)
def test_trend_boundaries(change, expected):
    assert metric_trend(change, 8) == expected
    assert trajectory({"attendance_change_4wk": change}) == expected
    assert trajectory({"attendance_change_4wk": 20, "score_change_4wk": -10}) == "declining"
