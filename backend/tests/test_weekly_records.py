from datetime import date, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import (
    AuditLog,
    CourseOffering,
    CourseTeacher,
    StudentProfile,
    TeacherProfile,
    WeeklyRecord,
)


def ids(db):
    return db.scalar(select(StudentProfile)).id, db.scalar(select(CourseOffering)).id


def body(course, **fields):
    return {
        "course_offering_id": str(course),
        "classes_held": 10,
        "classes_attended": 8,
        "assessment_avg_score": 65,
        **fields,
    }


def test_eight_weeks_upsert_and_private_audit(client, db, auth_headers):
    student, course = ids(db)
    headers = auth_headers("teacher")
    records = [
        {
            **body(course),
            "student_id": str(student),
            "week_start": str(date(2026, 1, 5) + timedelta(weeks=i)),
        }
        for i in range(8)
    ]
    response = client.post(
        "/api/v1/teacher/weekly-records/batch", headers=headers, json={"records": records}
    )
    assert response.status_code == 200, response.text
    original = response.json()
    path = f"/api/v1/teacher/students/{student}/weekly-records/2026-02-23"
    revised = body(course, classes_attended=9, student_checkin_text="Private student reflection")
    response = client.put(path, headers=headers, json=revised)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == original[-1]["id"]
    assert client.put(path, headers=headers, json=revised).status_code == 200
    history = client.get(
        f"/api/v1/teacher/students/{student}/weekly-records",
        headers=headers,
        params={"course_offering_id": str(course)},
    ).json()
    assert len(history) == 8
    assert history[-2]["classes_attended"] == 8 and history[-1]["classes_attended"] == 9
    logs = db.scalars(select(AuditLog).where(AuditLog.entity_type == "weekly_record")).all()
    assert len(logs) == 9
    assert "Private student reflection" not in str([r.details for r in logs])


@pytest.mark.parametrize(
    "invalid",
    [
        {"classes_attended": 11},
        {"assessment_avg_score": 101},
        {"quiz_count": -1},
        {"assignment_count": 1, "late_submissions": 2},
        {"student_confidence_score": 0},
        {"lms_active_days": 8},
        {"study_hours_weekly": 169},
        {"attendance_percent": 90},
        {"school_id": "spoof"},
        {"source": "csv_import"},
        {"risk_score": 0.5},
    ],
)
def test_raw_validation(client, db, auth_headers, invalid):
    student, course = ids(db)
    response = client.put(
        f"/api/v1/teacher/students/{student}/weekly-records/2026-01-05",
        headers=auth_headers("teacher"),
        json=body(course, **invalid),
    )
    assert response.status_code == 422
    assert db.scalar(select(func.count()).select_from(WeeklyRecord)) == 0


def test_week_dates_nulls_and_required_course(client, db, auth_headers):
    student, course = ids(db)
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student}/weekly-records"
    assert client.put(path + "/2026-01-06", headers=headers, json=body(course)).status_code == 422
    response = client.put(
        path + "/2026-01-05", headers=headers, json={"course_offering_id": str(course)}
    )
    assert response.status_code == 200
    assert response.json()["classes_attended"] is None
    assert client.get(path, headers=headers).status_code == 422
    assert (
        client.get(
            path,
            headers=headers,
            params={
                "course_offering_id": str(course),
                "date_from": "2026-02-01",
                "date_to": "2026-01-01",
            },
        ).status_code
        == 422
    )


def test_weekly_batch_atomic_permission_failure(client, db, demo, school_b, auth_headers):
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    headers = auth_headers("teacher")
    records = [
        {**body(course.id), "student_id": str(student.id), "week_start": "2026-01-05"},
        {
            **body(school_b["course"].id),
            "student_id": str(school_b["student_profile"].id),
            "week_start": "2026-01-05",
        },
    ]
    assert (
        client.post(
            "/api/v1/teacher/weekly-records/batch", headers=headers, json={"records": records}
        ).status_code
        == 404
    )
    assert db.scalar(select(func.count()).select_from(WeeklyRecord)) == 0
    assert db.scalar(select(func.count()).select_from(AuditLog)) == 0
    assert (
        client.post(
            "/api/v1/teacher/weekly-records/batch",
            headers=headers,
            json={"records": [records[0], records[0]]},
        ).status_code
        == 422
    )
    path = f"/api/v1/teacher/students/{school_b['student_profile'].id}/weekly-records"
    assert (
        client.get(
            path,
            headers=headers,
            params={
                "course_offering_id": str(school_b["course"].id),
            },
        ).status_code
        == 404
    )


def test_same_student_different_course_is_not_authorized(client, db, demo, auth_headers):
    student, original = ids(db)
    course = db.get(CourseOffering, original)
    other = CourseOffering(
        school_id=demo.id,
        classroom_id=course.classroom_id,
        subject_id=course.subject_id,
        academic_year="2026",
    )
    db.add(other)
    db.flush()
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student}/weekly-records/2026-01-05"
    assert client.put(path, headers=headers, json=body(other.id)).status_code == 404
    db.add(
        CourseTeacher(
            school_id=demo.id,
            course_offering_id=other.id,
            teacher_id=db.scalar(select(TeacherProfile)).id,
        )
    )
    db.flush()
    assert client.put(path, headers=headers, json=body(other.id)).status_code == 404
    for role in ("admin", "student"):
        assert client.put(path, headers=auth_headers(role), json=body(original)).status_code == 403


def test_weekly_database_constraints(db, demo):
    student, course = ids(db)
    teacher = db.scalar(select(TeacherProfile))
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(
            WeeklyRecord(
                school_id=demo.id,
                student_id=student,
                course_offering_id=course,
                week_start=date(2026, 1, 5),
                created_by=teacher.user_id,
                classes_held=1,
                classes_attended=2,
            )
        )
        db.flush()
