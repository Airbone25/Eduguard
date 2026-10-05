from datetime import date

import pytest
from sqlalchemy import select
from test_dashboard import roster

from app.models import Intervention, InterventionUpdate, WeeklyRecord
from app.services.student_progress_service import on_time_streak

FORBIDDEN = {
    "risk_probability",
    "risk_level",
    "at_risk",
    "severity",
    "explanations",
    "signals",
    "prediction_id",
    "feature_snapshot_id",
    "note",
    "notes",
    "private_notes",
    "details",
}


def assert_private_fields_absent(value):
    if isinstance(value, dict):
        assert not (value.keys() & FORBIDDEN)
        for item in value.values():
            assert_private_fields_absent(item)
    elif isinstance(value, list):
        for item in value:
            assert_private_fields_absent(item)


def test_student_progress_and_visible_goals_are_private(client, db, demo, auth_headers):
    course, teacher, students = roster(db, demo)
    rows = db.scalars(
        select(WeeklyRecord)
        .where(WeeklyRecord.student_id == students[0].id)
        .order_by(WeeklyRecord.week_start)
    ).all()
    for i, row in enumerate(rows):
        row.classes_attended = 4 + i
        row.assessment_avg_score = 30 + 10 * i
        row.assignment_count = 4
        row.assignments_completed = 4
        row.late_submissions = 0
    visible = Intervention(
        school_id=demo.id,
        student_id=students[0].id,
        course_offering_id=course.id,
        created_by=teacher.id,
        title="Math practice",
        start_date=date(2026, 2, 9),
        visibility_to_student=True,
        goal_definition={
            "attendance_target": 95,
            "risk_probability": 0.99,
            "private_notes": "Hidden nested content",
        },
    )
    db.add_all(
        [
            visible,
            Intervention(
                school_id=demo.id,
                student_id=students[0].id,
                course_offering_id=course.id,
                created_by=teacher.id,
                title="Hidden intervention",
                start_date=date(2026, 2, 9),
                visibility_to_student=False,
            ),
            Intervention(
                school_id=demo.id,
                student_id=students[1].id,
                course_offering_id=course.id,
                created_by=teacher.id,
                title="Another student's action",
                start_date=date(2026, 2, 9),
                visibility_to_student=True,
            ),
        ]
    )
    db.flush()
    db.add(
        InterventionUpdate(
            school_id=demo.id,
            intervention_id=visible.id,
            author_user_id=teacher.id,
            kind="note",
            sequence=1,
            note="Private teacher note",
            details={"severity": 1},
        )
    )
    db.add(
        WeeklyRecord(
            school_id=demo.id,
            student_id=students[0].id,
            course_offering_id=course.id,
            week_start=date(2026, 2, 16),
            created_by=teacher.id,
            assessment_avg_score=0,
        )
    )
    db.flush()
    prediction = client.post(
        f"/api/v1/teacher/students/{students[0].id}/predictions",
        headers=auth_headers("teacher"),
        json={"course_offering_id": str(course.id), "as_of_date": "2026-02-09"},
    )
    assert prediction.status_code == 201
    headers = auth_headers("student")
    params = {"course_offering_id": str(course.id), "as_of_date": "2026-02-09"}
    for resource in ("dashboard", "progress", "interventions", "goals"):
        response = client.get(f"/api/v1/student/me/{resource}", headers=headers, params=params)
        assert response.status_code == 200, response.text
        assert_private_fields_absent(response.json())
        assert "Hidden" not in response.text and "Private teacher" not in response.text
        assert "Another student's action" not in response.text
    dashboard = client.get("/api/v1/student/me/dashboard", headers=headers, params=params).json()
    assert dashboard["student_id"] == str(students[0].id)
    progress = dashboard["courses"][0]
    assert progress["attendance"] == {"current": 90, "change_4wk": 40, "trend": "improving"}
    assert progress["academic"]["current"] == 80 and len(progress["weeks"]) == 6
    assert progress["assignments"] == {
        "total": 4,
        "completed": 4,
        "completion_percent": 100,
        "on_time_streak_weeks": 6,
    }
    assert len(progress["improvements"]) == 3
    assert len(dashboard["visible_interventions"]) == len(dashboard["goals"]) == 1
    assert dashboard["goals"][0]["targets"]["attendance_target"] == 95


def test_student_roles_tenant_and_self_only(client, db, demo, school_b, auth_headers):
    course, teacher, students = roster(db, demo)
    for resource in ("dashboard", "progress", "interventions", "goals"):
        path = f"/api/v1/student/me/{resource}"
        for role in ("admin", "teacher"):
            assert client.get(path, headers=auth_headers(role)).status_code == 403
        assert (
            client.get(
                path,
                headers=auth_headers("student", "school-b"),
                params={"course_offering_id": str(course.id)},
            ).status_code
            == 404
        )
    own = client.get(
        "/api/v1/student/me/progress",
        headers=auth_headers("student"),
        params={"student_id": str(students[1].id), "school_id": str(school_b["school"].id)},
    ).json()
    assert own["student_id"] == str(students[0].id)
    path = f"/api/v1/teacher/students/{students[0].id}/progress"
    assert (
        client.get(
            path, headers=auth_headers("teacher"), params={"course_offering_id": str(course.id)}
        ).status_code
        == 200
    )
    assert (
        client.get(
            path,
            headers=auth_headers("teacher", "school-b"),
            params={"course_offering_id": str(course.id)},
        ).status_code
        == 404
    )


def test_missing_completion_and_invalid_raw_counts(client, db, demo, auth_headers):
    course, teacher, students = roster(db, demo)
    response = client.get(
        "/api/v1/student/me/dashboard",
        headers=auth_headers("student"),
        params={"as_of_date": "2026-02-09"},
    ).json()
    assert response["courses"][0]["assignments"]["completed"] is None
    assert response["courses"][0]["assignments"]["on_time_streak_weeks"] is None
    for fields in (
        {"assignment_count": 2, "assignments_completed": 3},
        {"assignments_completed": 1, "late_submissions": 2},
    ):
        response = client.put(
            f"/api/v1/teacher/students/{students[0].id}/weekly-records/2026-02-09",
            headers=auth_headers("teacher"),
            json={"course_offering_id": str(course.id), **fields},
        )
        assert response.status_code == 422


@pytest.mark.parametrize(
    "completed,late,total,expected",
    [(4, 0, 4, 1), (3, 0, 4, 0), (None, 0, 4, None), (None, 1, 4, 0), (0, 0, 0, 0)],
)
def test_measured_on_time_streak(completed, late, total, expected):
    row = WeeklyRecord(
        week_start=date(2026, 2, 9),
        assignment_count=total,
        assignments_completed=completed,
        late_submissions=late,
    )
    assert on_time_streak([row], date(2026, 2, 9)) == expected
    assert on_time_streak([row], date(2026, 2, 16)) is None
