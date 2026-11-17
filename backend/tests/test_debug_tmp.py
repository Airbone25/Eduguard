from datetime import date, timedelta

from sqlalchemy import select

from app.ml.forecast import FORECAST_COLUMNS, _fit_trend, _series, forecast_paths
from app.ml.model_loader import load_model
from app.services.feature_service import student_history_rows
from app.services.forecast_service import _forecast_anchor
from tests.test_forecast import MONDAY, add_history

from app.models import CourseOffering, StudentProfile, User


def test_debug_two_calls(client, db, demo, auth_headers):
    student = db.scalar(select(StudentProfile).where(StudentProfile.school_id == demo.id))
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    add_history(db, demo.id)
    headers = auth_headers("teacher")
    path = f"/api/v1/teacher/students/{student.id}/forecast?course_offering_id={course.id}"
    for call in range(2):
        response = client.get(path, headers=headers)
        print(f"\n=== HTTP CALL {call} status={response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("  as_of:", result["as_of_date"], "history_weeks:", result["history_weeks"])
            print("  points:", [(p["horizon"], round(p["risk_probability"], 6), round(p["band_low"], 6), round(p["band_high"], 6)) for p in result["points"]])
        else:
            print("  body:", response.json())
