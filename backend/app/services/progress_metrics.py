"""Measured progress only: no model calls, labels or imputation."""

from datetime import date, timedelta

from app.ml.feature_builder import FeatureResult, build_features
from app.models import WeeklyRecord
from app.schemas.dashboard import Trend
from app.schemas.weekly_record import WeeklyData


def week_anchor(day: date) -> date:
    return day - timedelta(days=day.weekday())


def history_features(rows: list[WeeklyRecord], as_of_date: date) -> FeatureResult:
    fields = set(WeeklyData.model_fields) - {"student_checkin_text"}
    return build_features(
        [{"week_start": row.week_start, **{f: getattr(row, f) for f in fields}} for row in rows],
        as_of_date,
    )


def metric_trend(change: float | None, threshold: float) -> Trend:
    if change is None:
        return "insufficient_history"
    if change <= -threshold:
        return "declining"
    if change >= threshold:
        return "improving"
    return "stable"


def trajectory(features: dict) -> Trend:
    trends = {
        metric_trend(features.get("attendance_change_4wk"), 8),
        metric_trend(features.get("score_change_4wk"), 10),
    }
    for trend in ("declining", "improving", "stable"):
        if trend in trends:
            return trend
    return "insufficient_history"
