from sqlalchemy import select

from app.models import InterventionTemplate
from app.services.explanation_service import explanation_signals
from app.services.recommendation_service import recommend


def test_explanations_are_deterministic_and_grounded():
    features = {
        "attendance_change_4wk": -12,
        "score_change_4wk": -15,
        "late_submission_streak": 3,
        "participation_rate": 20,
    }
    signals = explanation_signals(features)
    assert signals == explanation_signals(dict(reversed(list(features.items()))))
    assert len(signals) == 3
    assert any("12.0 points" in signal["message"] for signal in signals)
    assert explanation_signals({}) == []


def test_recommendation_ranking_and_school_override(client, db, demo, school_b, auth_headers):
    attendance = [{"factor": "attendance", "severity": 1, "message": "Measured attendance decline"}]
    scores = [{"factor": "avg_score", "severity": 1, "message": "Measured score decline"}]
    first = recommend(db, demo.id, attendance)[0]
    assert first["name"] == "Morning attendance check-in"
    assert recommend(db, demo.id, scores)[0]["name"] == "One-on-one subject review"
    headers = auth_headers()
    response = client.post(
        "/api/v1/admin/intervention-templates",
        headers=headers,
        json={
            "name": first["name"],
            "description": "Disabled at this school",
            "tags": {"attendance": 1},
            "is_active": False,
        },
    )
    assert response.status_code == 201
    assert recommend(db, demo.id, attendance) == []
    assert recommend(db, school_b["school"].id, attendance)[0]["name"] == first["name"]
    assert (
        client.patch(
            f"/api/v1/admin/intervention-templates/{response.json()['id']}",
            headers=auth_headers("admin", "school-b"),
            json={"is_active": True},
        ).status_code
        == 404
    )
    default = db.scalar(
        select(InterventionTemplate).where(InterventionTemplate.school_id.is_(None))
    )
    assert (
        client.patch(
            f"/api/v1/admin/intervention-templates/{default.id}",
            headers=headers,
            json={"is_active": False},
        ).status_code
        == 404
    )
    assert (
        client.get(
            "/api/v1/admin/intervention-templates", headers=auth_headers("teacher")
        ).status_code
        == 403
    )
