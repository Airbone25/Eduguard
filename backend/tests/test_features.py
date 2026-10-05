from datetime import date, timedelta
from math import sqrt

import pytest
from sqlalchemy import select

from app.core.exceptions import APIError
from app.ml.feature_builder import build_features
from app.models import CourseOffering, StudentProfile, TeacherProfile, User, WeeklyRecord
from app.services.feature_service import build_student_features


def history():
    return [
        {
            "week_start": date(2026, 1, 5) + timedelta(weeks=i),
            "classes_held": 10,
            "classes_attended": 5 + i,
            "assessment_avg_score": 40 + 10 * i,
            "study_hours_weekly": 2 + i,
            "late_submissions": [0, 1, 0, 2, 1][i],
            "assignment_count": 4,
            "last_minute_submissions": 1,
            "participation_count": 3,
            "participation_opportunities": 4,
            "quiz_avg_score": 50 + i,
        }
        for i in range(5)
    ]


def test_exact_feature_math():
    rows = history()
    result = build_features(rows, rows[-1]["week_start"])
    f = result.features
    assert f["attendance_percent"] == 90
    assert f["avg_score"] == 80
    assert f["score_std"] == pytest.approx(sqrt(200))
    for name, mean, change, volatility, trend in [
        ("attendance", 80, 40, sqrt(200), 10),
        ("score", 70, 40, sqrt(200), 10),
        ("study_hours", 5, 4, sqrt(2), 1),
    ]:
        assert f[f"{name}_3wk_avg"] == mean
        assert f[f"{name}_change_4wk"] == change
        assert f[f"{name}_volatility"] == pytest.approx(volatility)
        assert f[f"{name}_slope"] == pytest.approx(trend)
    assert f["late_submission_streak"] == 2
    assert f["low_score_streak"] == 0
    assert f["on_time_submissions"] == 3
    assert f["last_minute_submission_rate"] == 25
    assert f["quiz_score_volatility"] == pytest.approx(sqrt(2))
    assert f["engagement_score"] == 80
    assert f["academic_consistency"] == pytest.approx(100 - 2 * sqrt(200))
    assert result.metadata["history_weeks_available"] == 5


def test_no_future_leakage_and_order_independence():
    rows = history()
    cutoff = rows[2]["week_start"]
    expected = build_features(rows[:3], cutoff)
    assert build_features(list(reversed(rows)), cutoff) == expected
    rows[-1]["assessment_avg_score"] = 0
    assert build_features(rows, cutoff) == expected


def test_missing_history_and_zero_denominators():
    first = {
        "week_start": date(2026, 1, 5),
        "classes_held": 0,
        "classes_attended": 0,
        "assessment_avg_score": 40,
        "assignment_count": 0,
        "late_submissions": 0,
    }
    f = build_features([first], first["week_start"]).features
    for key in [
        "attendance_percent",
        "score_std",
        "score_3wk_avg",
        "score_change_4wk",
        "score_slope",
        "engagement_score",
        "academic_consistency",
    ]:
        assert f[key] is None
    assert f["low_score_streak"] == 1
    assert f["late_submission_streak"] == 0
    empty = build_features([], first["week_start"])
    assert all(v is None for v in empty.features.values())


def test_gaps_are_not_compressed_or_imputed():
    rows = history()
    rows.pop(3)
    f = build_features(rows, date(2026, 2, 2)).features
    assert f["score_3wk_avg"] is None
    assert f["late_submission_streak"] is None
    assert f["score_slope"] == pytest.approx(10)  # Actual elapsed weeks, not row index.
    assert f["score_change_4wk"] == 40
    stale = build_features(rows, date(2026, 2, 9)).features
    assert stale["avg_score"] is None


def test_eight_week_window_and_duplicate_rejection():
    rows = [
        {"week_start": date(2026, 1, 5) + timedelta(weeks=i), "assessment_avg_score": i}
        for i in range(10)
    ]
    result = build_features(rows, rows[-1]["week_start"])
    assert result.metadata["history_weeks_available"] == 8
    with pytest.raises(ValueError):
        build_features([rows[-1], rows[-1]], rows[-1]["week_start"])


def test_feature_service_tenant_course_and_as_of_filter(db, demo, school_b):
    teacher = db.scalar(
        select(User).where(User.school_id == demo.id, User.email == "teacher@demo.edu")
    )
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    for row in history():
        db.add(
            WeeklyRecord(
                school_id=demo.id,
                student_id=student.id,
                course_offering_id=course.id,
                created_by=teacher.id,
                student_checkin_text="Sensitive text",
                **row,
            )
        )
    db.flush()
    cutoff = date(2026, 1, 19)
    result = build_student_features(db, teacher, student.id, course.id, cutoff)
    assert result.features["avg_score"] == 60
    assert result.metadata["history_weeks_available"] == 3
    assert "Sensitive" not in result.model_dump_json()
    with pytest.raises(APIError) as exc:
        build_student_features(
            db, teacher, school_b["student_profile"].id, school_b["course"].id, cutoff
        )
    assert exc.value.status_code == 404
    assignment = db.scalar(select(TeacherProfile).where(TeacherProfile.school_id == demo.id))
    assert assignment.user_id == teacher.id
