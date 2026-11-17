import math
from datetime import date, timedelta
from uuid import UUID

import pytest
from sqlalchemy import func, select

from app.ml.explain import feature_contributions
from app.ml.model_loader import load_model
from app.models import CourseOffering, RiskPrediction, StudentProfile, User, WeeklyRecord
from app.schemas.prediction import FeatureContribution


def add_history(db, school_id, weeks: int = 5):
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
                week_start=date(2026, 1, 5) + timedelta(weeks=i),
                created_by=teacher.id,
                classes_held=10,
                classes_attended=9 - i,
                assessment_avg_score=80 - 10 * i,
                assignment_count=5,
                late_submissions=1 + i,
            )
        )
    db.flush()
    return student, course


def create_prediction(client, db, demo, auth_headers):
    student, course = add_history(db, demo.id)
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/predictions"
    created = client.post(
        path,
        headers=headers,
        json={"course_offering_id": str(course.id), "as_of_date": "2026-02-02"},
    )
    assert created.status_code == 201, created.text
    return headers, path, course, created.json()


def test_contributions_reproduce_logit_and_rank(client, db, demo, auth_headers):
    headers, path, course, body = create_prediction(client, db, demo, auth_headers)
    contributions = body["contributions"]
    model = load_model("artifacts/eduguard_risk_model.joblib", "artifacts/model_metadata.json")
    # The imputer drops never-observed columns (Sentiment_Score), so the
    # classifier sees exactly the retained subset — mislabeling is impossible.
    from app.ml.explain import retained_feature_names

    expected_names = retained_feature_names(model)
    assert "Sentiment_Score" not in expected_names
    assert len(contributions) == len(expected_names) == 39
    assert {item["name"] for item in contributions} == set(expected_names)
    # Sorted by |contribution|, descending.
    magnitudes = [abs(item["contribution"]) for item in contributions]
    assert magnitudes == sorted(magnitudes, reverse=True)
    FeatureContribution.model_validate(contributions[0])

    # The logit identity: sum(contributions) + intercept == log-odds of the
    # returned probability, so the explanation cannot drift from the prediction.
    probability = body["risk_probability"]
    logit = math.log(probability / (1 - probability))
    total = sum(item["contribution"] for item in contributions)
    intercept = model.pipeline.steps[-1][1].intercept_[0]
    assert abs(total + intercept - logit) < 1e-4

    # The listing endpoint carries the same attributions.
    listed = client.get(path, headers=headers, params={"course_offering_id": str(course.id)})
    assert listed.status_code == 200
    assert listed.json()[0]["contributions"] == contributions


def test_feature_contributions_rejects_mismatched_inputs():
    model = load_model("artifacts/eduguard_risk_model.joblib", "artifacts/model_metadata.json")
    with pytest.raises(ValueError):
        feature_contributions(model, {"Not_A_Feature": 1.0})


def test_what_if_changes_probability_and_respects_rules(client, db, demo, auth_headers):
    headers, path, course, body = create_prediction(client, db, demo, auth_headers)
    prediction_id = body["id"]
    url = "/api/v1/teacher/predictions/what-if"

    # Simulated attendance recovery and punctual submissions.
    response = client.post(
        url,
        headers=headers,
        json={
            "prediction_id": prediction_id,
            "overrides": {"Attendance_Percent": 95, "Late_Submissions": 0},
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["prediction_id"] == prediction_id
    assert result["applied_overrides"] == {"Attendance_Percent": 95.0, "Late_Submissions": 0.0}
    assert 0 <= result["probability"] <= 1
    assert result["baseline_probability"] == pytest.approx(body["risk_probability"], abs=1e-9)
    assert result["support_level"] in ("doing_well", "watch", "priority_support")
    assert abs(result["delta"]) > 0

    # Whitelist: unknown feature is rejected.
    unknown = client.post(
        url, headers=headers, json={"prediction_id": prediction_id, "overrides": {"Math": 90}}
    )
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "UNKNOWN_SIMULATION_FEATURE"
    # Range check.
    out_of_range = client.post(
        url,
        headers=headers,
        json={"prediction_id": prediction_id, "overrides": {"Avg_Score": 150}},
    )
    assert out_of_range.status_code == 422
    assert out_of_range.json()["error"]["code"] == "SIMULATION_VALUE_OUT_OF_RANGE"
    # Unknown prediction.
    missing = client.post(
        url,
        headers=headers,
        json={"prediction_id": str(UUID(int=0)), "overrides": {"Avg_Score": 60}},
    )
    assert missing.status_code == 404
    # Nothing was persisted by the simulation.
    assert db.scalar(select(func.count()).select_from(RiskPrediction)) == 1


def test_what_if_requires_course_access(client, db, demo, school_b, auth_headers):
    headers, path, course, body = create_prediction(client, db, demo, auth_headers)
    outsider = auth_headers("teacher", "school-b")
    response = client.post(
        "/api/v1/teacher/predictions/what-if",
        headers=outsider,
        json={
            "prediction_id": body["id"],
            "overrides": {"Avg_Score": 60},
        },
    )
    assert response.status_code == 404
