from datetime import date, timedelta
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.models import (
    CourseOffering,
    CourseTeacher,
    FeatureSnapshot,
    ModelVersion,
    RiskPrediction,
    StudentProfile,
    User,
    WeeklyRecord,
)


def add_history(db, school_id):
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == school_id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == school_id))
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
                late_submissions=2,
            )
        )
    db.flush()
    return student, course


def test_predictions_persist_and_future_records_do_not_change_snapshot(
    client, db, demo, auth_headers
):
    student, course = add_history(db, demo.id)
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/predictions"
    body = {"course_offering_id": str(course.id), "as_of_date": "2026-02-02"}
    first = client.post(path, headers=headers, json=body)
    assert first.status_code == 201, first.text
    result = first.json()
    assert result["model_version"] == "current-joblib-v1"
    assert result["signals"] and result["recommendations"]
    snapshot = db.get(FeatureSnapshot, UUID(result["feature_snapshot_id"]))
    original = snapshot.features.copy()
    assert len(original["feature_names"]) == 40
    assert original["values"]["Attendance_Percent"] == 50
    assert original["values"]["Physics"] is None
    assert snapshot.as_of_date == date(2026, 2, 2)
    row = db.get(RiskPrediction, UUID(result["id"]))
    assert row.school_id == demo.id and row.student_id == student.id
    assert row.model_version_id == UUID(result["model_version_id"])
    assert db.get(ModelVersion, row.model_version_id).artifact_sha256
    teacher = db.scalar(select(User).where(User.email == "teacher@demo.edu"))
    db.add(
        WeeklyRecord(
            school_id=demo.id,
            student_id=student.id,
            course_offering_id=course.id,
            week_start=date(2026, 2, 9),
            created_by=teacher.id,
            classes_held=10,
            classes_attended=0,
            assessment_avg_score=0,
        )
    )
    db.flush()
    second = client.post(path, headers=headers, json=body)
    assert second.status_code == 201
    assert second.json()["risk_probability"] == result["risk_probability"]
    db.refresh(snapshot)
    assert snapshot.features == original
    listed = client.get(path, headers=headers, params={"course_offering_id": str(course.id)})
    assert listed.status_code == 200 and len(listed.json()) == 2
    assert db.scalar(select(func.count()).select_from(ModelVersion)) == 1


def test_prediction_permissions_and_raw_feature_injection(client, db, demo, school_b, auth_headers):
    student, course = add_history(db, demo.id)
    path = f"/api/v1/teacher/students/{student.id}/predictions"
    body = {"course_offering_id": str(course.id), "as_of_date": "2026-02-02"}
    for role in ("admin", "student"):
        assert client.post(path, headers=auth_headers(role), json=body).status_code == 403
    outsider = auth_headers("teacher", "school-b")
    assert client.post(path, headers=outsider, json=body).status_code == 404
    assert (
        client.get(
            path, headers=outsider, params={"course_offering_id": str(course.id)}
        ).status_code
        == 404
    )
    assert (
        client.post(
            path, headers=auth_headers("teacher"), json={**body, "features": {"Math": 100}}
        ).status_code
        == 422
    )
    assert db.scalar(select(func.count()).select_from(RiskPrediction)) == 0


def test_class_prediction_and_insufficient_history(client, db, demo, auth_headers):
    student = db.scalar(select(StudentProfile))
    course = db.scalar(select(CourseOffering))
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/predictions"
    assert (
        client.post(
            path,
            headers=headers,
            json={"course_offering_id": str(course.id), "as_of_date": "2026-02-02"},
        ).status_code
        == 422
    )
    assert db.scalar(select(func.count()).select_from(FeatureSnapshot)) == 0
    add_history(db, demo.id)
    result = client.post(
        f"/api/v1/teacher/classes/{course.id}/predictions",
        headers=headers,
        json={"as_of_date": "2026-02-02"},
    )
    assert result.status_code == 201 and len(result.json()) == 1


def test_model_readiness_failure_is_clear(client, db, monkeypatch):
    import app.main as main

    def failed_load(*args):
        raise ValueError("Invalid model metadata")

    monkeypatch.setattr(main, "load_model", failed_load)
    with TestClient(main.app) as failed:
        assert failed.get("/health").status_code == 200
        response = failed.get("/ready")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "MODEL_UNAVAILABLE"


def test_registry_mismatch_is_rejected_atomically(client, db, demo, auth_headers):
    student, course = add_history(db, demo.id)
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/predictions"
    body = {"course_offering_id": str(course.id), "as_of_date": "2026-02-02"}
    assert client.post(path, headers=headers, json=body).status_code == 201
    db.scalar(select(ModelVersion)).artifact_sha256 = "0" * 64
    db.flush()
    assert client.post(path, headers=headers, json=body).status_code == 503
    assert db.scalar(select(func.count()).select_from(RiskPrediction)) == 1
    assert db.scalar(select(func.count()).select_from(FeatureSnapshot)) == 1


def test_raw_weekly_api_to_persisted_prediction_and_revoked_assignment(
    client, db, demo, auth_headers
):
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    headers = auth_headers("teacher")
    records = [
        {
            "student_id": str(student.id),
            "course_offering_id": str(course.id),
            "week_start": (date(2026, 1, 5) + timedelta(weeks=i)).isoformat(),
            "classes_held": 10,
            "classes_attended": 9 - i,
            "assessment_avg_score": 80 - i * 10,
            "assignment_count": 5,
            "late_submissions": i,
        }
        for i in range(5)
    ]
    uploaded = client.post(
        "/api/v1/teacher/weekly-records/batch", headers=headers, json={"records": records}
    )
    assert uploaded.status_code == 200, uploaded.text
    assert len(uploaded.json()) == 5
    path = f"/api/v1/teacher/students/{student.id}/predictions"
    body = {"course_offering_id": str(course.id), "as_of_date": "2026-02-02"}
    prediction = client.post(path, headers=headers, json=body)
    assert prediction.status_code == 201, prediction.text
    snapshot = db.get(FeatureSnapshot, UUID(prediction.json()["feature_snapshot_id"]))
    assert snapshot.features["values"]["Attendance_Percent"] == 50
    assert snapshot.features["values"]["Score_Change_4Wk"] == -40
    assert snapshot.features["values"]["Late_Submission_Streak"] == 4
    assert 0 <= prediction.json()["risk_probability"] <= 1
    assignment = db.scalar(
        select(CourseTeacher).where(CourseTeacher.course_offering_id == course.id)
    )
    db.delete(assignment)
    # Complete the separate administrative change before API transaction rollback.
    # The fixture's enclosing transaction still isolates/cleans up the whole test.
    db.commit()
    assert client.post(path, headers=headers, json=body).status_code == 404
    assert (
        client.get(path, headers=headers, params={"course_offering_id": str(course.id)}).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/teacher/classes/{course.id}/predictions",
            headers=headers,
            json={"as_of_date": "2026-02-02"},
        ).status_code
        == 404
    )
    assert db.scalar(select(func.count()).select_from(RiskPrediction)) == 1
