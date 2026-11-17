from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.ml.forecast import BAND_LEVEL, FORECAST_HORIZON_WEEKS, _bounds, _fit_trend
from app.models import CourseOffering, StudentProfile, User, WeeklyRecord

MONDAY = date(2026, 1, 5)


def add_history(db, school_id, weeks=5, late=None):
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == school_id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == school_id))
    teacher = db.scalar(
        select(User).where(User.school_id == school_id, User.email == "teacher@demo.edu")
    )
    for i in range(weeks):
        db.add(
            WeeklyRecord(
                school_id=school_id,
                student_id=student.id,
                course_offering_id=course.id,
                week_start=MONDAY + timedelta(weeks=i),
                created_by=teacher.id,
                classes_held=10,
                classes_attended=9 - i,
                assessment_avg_score=[80, 68, 62, 48, 42][i],
                assignment_count=5,
                late_submissions=2 if late is None else late,
            )
        )
    db.flush()
    return student, course


def test_forecast_projects_widening_band_deterministically(client, db, demo, auth_headers):
    student, course = add_history(db, demo.id)
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/forecast?course_offering_id={course.id}"
    first = client.get(path, headers=headers)
    assert first.status_code == 200, first.text
    result = first.json()
    assert result["student_id"] == str(student.id)
    assert result["course_offering_id"] == str(course.id)
    assert result["as_of_date"] == (MONDAY + timedelta(weeks=4)).isoformat()
    assert result["horizon_weeks"] == FORECAST_HORIZON_WEEKS
    assert result["band_level"] == BAND_LEVEL
    assert result["history_weeks"] == 5
    assert "not a diagnosis" in result["method"]
    points = result["points"]
    assert [p["horizon"] for p in points] == [1, 2, 3, 4]
    assert points[0]["week_start"] == (MONDAY + timedelta(weeks=5)).isoformat()
    for point in points:
        assert point["band_low"] <= point["risk_probability"] <= point["band_high"]
        assert 0 <= point["band_low"] and point["band_high"] <= 1
    # A declining student's projected probability does not fall back.
    probabilities = [p["risk_probability"] for p in points]
    assert probabilities == sorted(probabilities)
    # The cone widens as the horizon grows.
    widths = [p["band_high"] - p["band_low"] for p in points]
    assert widths[-1] > widths[0]
    again = client.get(path, headers=headers)
    assert again.status_code == 200
    assert again.json()["points"] == points


def test_forecast_anchor_follows_latest_insight(client, db, demo, auth_headers):
    student, course = add_history(db, demo.id)
    headers = auth_headers("teacher")
    body = {"course_offering_id": str(course.id), "as_of_date": "2026-02-02"}
    created = client.post(
        f"/api/v1/teacher/students/{student.id}/predictions", headers=headers, json=body
    )
    assert created.status_code == 201, created.text
    result = client.get(
        f"/api/v1/teacher/students/{student.id}/forecast?course_offering_id={course.id}",
        headers=headers,
    )
    assert result.status_code == 200
    assert result.json()["as_of_date"] == "2026-02-02"
    assert result.json()["points"][0]["week_start"] == "2026-02-09"


def test_forecast_requires_recorded_weeks(client, db, demo, auth_headers):
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/forecast?course_offering_id={course.id}"
    empty = client.get(path, headers=headers)
    assert empty.status_code == 422
    assert empty.json()["error"]["code"] == "FORECAST_INSUFFICIENT_HISTORY"
    add_history(db, demo.id, weeks=2)
    sparse = client.get(path, headers=headers)
    assert sparse.status_code == 422
    assert sparse.json()["error"]["code"] == "FORECAST_INSUFFICIENT_HISTORY"


def test_forecast_is_teacher_only_and_tenant_scoped(client, db, demo, auth_headers, school_b):
    student, course = add_history(db, demo.id)
    student_role = client.get(
        f"/api/v1/teacher/students/{student.id}/forecast?course_offering_id={course.id}",
        headers=auth_headers("student"),
    )
    assert student_role.status_code == 403
    assert student_role.json()["error"]["code"] == "ROLE_FORBIDDEN"
    other_school = client.get(
        f"/api/v1/teacher/students/{student.id}/forecast?course_offering_id={course.id}",
        headers=auth_headers("teacher", slug="school-b"),
    )
    assert other_school.status_code == 404


def test_fit_trend_uncertainty_rules():
    single = _fit_trend([(MONDAY, 5.0)], "assessment_avg_score")
    assert single.observed and single.slope == 0 and single.std == 0
    pair = _fit_trend([(MONDAY, 5.0), (MONDAY + timedelta(weeks=1), 1.0)], "classes_attended")
    assert pair.slope == -4.0
    assert pair.std > 0
    # A perfectly linear history is explained exactly by its trend line.
    linear = _fit_trend(
        [(MONDAY + timedelta(weeks=i), float(9 - i)) for i in range(5)],
        "classes_attended",
    )
    assert linear.slope == -1.0
    assert linear.std == 0
    # Any departure from the line re-enters uncertainty.
    jittered = _fit_trend(
        [(MONDAY + timedelta(weeks=i), float(9 - i)) for i in range(4)] + [(MONDAY + timedelta(weeks=4), 4.0)],
        "classes_attended",
    )
    assert jittered.slope < -1.0
    assert jittered.std > 0
    never = _fit_trend([], "assessment_avg_score")
    assert not never.observed


def test_bounds_follow_input_contract():
    assert _bounds([105.0, 110.0], "assessment_avg_score") == (0.0, 100.0)
    assert _bounds([8.0, 9.0], "lms_active_days") == (0.0, 7.0)
    assert _bounds([4.0, 8.0], "classes_attended") == (0.0, float("inf"))
    assert _bounds([40.0, 80.0], "study_hours_weekly") == (0.0, 168.0)
