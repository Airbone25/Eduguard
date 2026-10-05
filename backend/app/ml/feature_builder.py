from collections.abc import Iterable, Mapping
from datetime import date, timedelta
from statistics import fmean, pstdev

from pydantic import BaseModel

from app.ml.feature_definitions import (
    DIRECT_FEATURES,
    FEATURE_VERSION,
    LOW_SCORE_THRESHOLD,
    WINDOW_WEEKS,
)


class FeatureResult(BaseModel):
    feature_version: str = FEATURE_VERSION
    as_of_date: date
    features: dict[str, float | int | None]
    metadata: dict


def percentage(numerator, denominator) -> float | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return 100 * float(numerator) / float(denominator)


def number(value) -> float | None:
    return float(value) if value is not None else None


def slope(points: list[tuple[date, float]]) -> float | None:
    if len(points) < 2:
        return None
    x = [(day - points[0][0]).days / 7 for day, _ in points]
    y = [value for _, value in points]
    x_mean, y_mean = fmean(x), fmean(y)
    denominator = sum((v - x_mean) ** 2 for v in x)
    return sum((a - x_mean) * (b - y_mean) for a, b in zip(x, y, strict=True)) / denominator


def trailing_streak(
    values: dict[date, float | None], anchor: date, earliest: date | None, predicate
) -> int | None:
    if earliest is None:
        return None
    streak, day = 0, anchor
    while day >= earliest:
        value = values.get(day)
        if value is None:
            return None  # Do not bridge missing weeks or unknown observations.
        if not predicate(value):
            break
        streak += 1
        day -= timedelta(weeks=1)
    return streak


def build_features(records: Iterable[Mapping], as_of_date: date) -> FeatureResult:
    """One student/course history. Calendar windows; no imputation or future rows."""
    anchor = as_of_date - timedelta(days=as_of_date.weekday())
    start = anchor - timedelta(weeks=WINDOW_WEEKS - 1)
    history = sorted(
        (dict(r) for r in records if start <= r["week_start"] <= as_of_date),
        key=lambda r: r["week_start"],
    )
    if len({r["week_start"] for r in history}) != len(history):
        raise ValueError("Expected one record per week for one student/course")
    if any(r["week_start"].weekday() != 0 for r in history):
        raise ValueError("Expected Monday week starts")
    current = next((r for r in history if r["week_start"] == anchor), {})
    features = {name: number(current.get(name)) for name in DIRECT_FEATURES}
    attendance = {
        r["week_start"]: percentage(r.get("classes_attended"), r.get("classes_held"))
        for r in history
    }
    scores = {r["week_start"]: number(r.get("assessment_avg_score")) for r in history}
    hours = {r["week_start"]: number(r.get("study_hours_weekly")) for r in history}
    # Current features refer to the requested week, never silently to an older record.
    features["attendance_percent"] = attendance.get(anchor)
    features["avg_score"] = scores.get(anchor)
    features["participation_rate"] = percentage(
        current.get("participation_count"), current.get("participation_opportunities")
    )
    assignments, late = current.get("assignment_count"), current.get("late_submissions")
    features["on_time_submissions"] = (
        assignments - late if assignments is not None and late is not None else None
    )
    features["last_minute_submission_rate"] = percentage(
        current.get("last_minute_submissions"), assignments
    )
    for name, series in [("attendance", attendance), ("score", scores), ("study_hours", hours)]:
        points = [(day, value) for day, value in sorted(series.items()) if value is not None]
        recent = [series.get(anchor - timedelta(weeks=i)) for i in range(3)]
        now, old = series.get(anchor), series.get(anchor - timedelta(weeks=4))
        features[f"{name}_3wk_avg"] = fmean(recent) if all(v is not None for v in recent) else None
        features[f"{name}_change_4wk"] = now - old if now is not None and old is not None else None
        features[f"{name}_volatility"] = (
            pstdev([v for _, v in points]) if len(points) >= 2 else None
        )
        features[f"{name}_slope"] = slope(points)
    # Weekly aggregate scores cannot reveal individual-assessment score dispersion.
    features["score_std"] = features["score_volatility"]
    quiz = [number(r["quiz_avg_score"]) for r in history if r.get("quiz_avg_score") is not None]
    features["quiz_score_volatility"] = pstdev(quiz) if len(quiz) >= 2 else None
    earliest = history[0]["week_start"] if history else None
    features["late_submission_streak"] = trailing_streak(
        {r["week_start"]: r.get("late_submissions") for r in history},
        anchor,
        earliest,
        lambda v: v > 0,
    )
    features["low_score_streak"] = trailing_streak(
        scores, anchor, earliest, lambda v: v < LOW_SCORE_THRESHOLD
    )
    engagement = [
        features["attendance_percent"],
        features["participation_rate"],
        percentage(features["on_time_submissions"], assignments),
    ]
    features["engagement_score"] = (
        fmean(engagement) if all(v is not None for v in engagement) else None
    )
    score_count = sum(v is not None for v in scores.values())
    features["academic_consistency"] = (
        max(0, 100 - 2 * features["score_std"]) if score_count >= 3 else None
    )
    features["sentiment_score"] = None  # No sentiment classifier has been supplied.
    return FeatureResult(
        as_of_date=as_of_date,
        features=features,
        metadata={
            "history_weeks_available": len(history),
            "window_weeks": WINDOW_WEEKS,
            "window_start": start.isoformat(),
            "window_end": anchor.isoformat(),
            "weeks_used": [r["week_start"].isoformat() for r in history],
            "score_observations": score_count,
        },
    )
