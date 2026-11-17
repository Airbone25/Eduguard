"""A4 forward-simulated forecast: project recorded weekly trends four weeks
ahead through the production feature builder and the active risk model.

The same `build_features` used for training and serving scores every simulated
window, so train/serve identity holds. The band is the empirical interval of
the simulated probability distribution; nothing here is a diagnosis.
"""

from datetime import date, timedelta
from statistics import fmean, pstdev

import numpy as np

from app.ml.feature_builder import build_features
from app.ml.feature_builder import slope as ols_slope
from app.ml.feature_definitions import DIRECT_FEATURES
from app.ml.inference import ordered_features, predict_batch

FORECAST_HORIZON_WEEKS = 4
FORECAST_SAMPLES = 200
FORECAST_SEED = 2026
BAND_LEVEL = 0.8
MIN_FORECAST_WEEKS = 4
METHOD = (
    "Forward-simulated weekly feature trends scored by the active risk model; "
    "the band is the 80% interval across 200 simulated paths. It projects "
    "recorded trends — it is not a diagnosis."
)

# Raw weekly columns the builder reads, plus the denominator columns it needs.
FORECAST_COLUMNS = tuple(
    sorted(
        set(DIRECT_FEATURES)
        | {"assessment_avg_score", "participation_opportunities", "last_minute_submissions"}
    )
)
_INT_COLUMNS = {
    "classes_held",
    "classes_attended",
    "assignment_count",
    "late_submissions",
    "quiz_count",
    "quiz_attempt_count",
    "lms_login_count",
    "lms_active_days",
    "days_since_last_login",
    "participation_count",
    "participation_opportunities",
}
# Schema-derived caps from the weekly-record contract; nothing beyond it is assumed.
_SCHEMA_CAPS = {
    "assessment_avg_score": 100.0,
    "assignment_avg_score": 100.0,
    "quiz_avg_score": 100.0,
    "study_hours_weekly": 168.0,
    "lms_active_days": 7.0,
}
_RELATION_CLAMP = (
    ("classes_attended", "classes_held"),
    ("late_submissions", "assignment_count"),
    ("last_minute_submissions", "assignment_count"),
    ("participation_count", "participation_opportunities"),
    ("quiz_attempt_count", "quiz_count"),
)


class _Trend:
    __slots__ = ("slope", "last", "std", "lower", "upper", "observed")

    def __init__(self, slope, last, std, lower, upper, observed):
        self.slope = slope
        self.last = last
        self.std = std
        self.lower = lower
        self.upper = upper
        self.observed = observed


def _series(records: list[dict], column: str) -> list[tuple[date, float]]:
    return [
        (row["week_start"], float(row[column]))
        for row in records
        if row.get(column) is not None
    ]


def _bounds(values: list[float], column: str) -> tuple[float, float]:
    """Extrapolation continues the fitted trend until the weekly-record input
    contract's physical limits: zero floor plus schema caps. A declining
    student keeps declining; only the contract stops the extrapolation."""
    return 0.0, _SCHEMA_CAPS.get(column, float("inf"))


def _fit_trend(points: list[tuple[date, float]], column: str) -> _Trend:
    """OLS over observed weeks. With fewer than three observations the residual
    standard deviation is undefined, so the observed spread is used instead —
    a varying column never reports zero uncertainty."""
    if not points:
        return _Trend(0.0, None, 0.0, 0.0, 0.0, False)
    values = [value for _, value in points]
    lower, upper = _bounds(values, column)
    if len(points) < 2:
        return _Trend(0.0, values[-1], 0.0, lower, upper, True)
    fitted = ols_slope(points) or 0.0
    if len(points) < 3:
        std = pstdev(values)
    else:
        x = [(day - points[0][0]).days / 7 for day, _ in points]
        x_mean, y_mean = fmean(x), fmean(values)
        residuals = [
            value - (y_mean + fitted * (x_value - x_mean))
            for value, x_value in zip(values, x, strict=True)
        ]
        std = pstdev(residuals)
    return _Trend(fitted, values[-1], std, lower, upper, True)


def _future_row(trends: dict[str, _Trend], draws, sample: int, week: int) -> dict:
    row: dict[str, float | int | None] = {}
    for index, column in enumerate(FORECAST_COLUMNS):
        trend = trends[column]
        if not trend.observed:
            row[column] = None
            continue
        noise = 0.0 if sample == 0 else float(draws[sample - 1, week - 1, index])
        value = trend.last + trend.slope * week + noise
        value = min(max(value, trend.lower), trend.upper)
        row[column] = round(value) if column in _INT_COLUMNS else round(value, 4)
    for child, parent in _RELATION_CLAMP:
        if row[child] is not None and row[parent] is not None:
            row[child] = min(row[child], row[parent])
    return row


def forecast_paths(
    model,
    subject_code: str,
    subject_name: str,
    records: list[dict],
    anchor: date,
) -> list[dict]:
    """Deterministic projection — same inputs always produce the same points:
    {week_start, horizon, risk_probability, band_low, band_high}. Sample 0 of
    every horizon is the noise-free trend path; the rest are sampled paths."""
    trends = {column: _fit_trend(_series(records, column), column) for column in FORECAST_COLUMNS}
    # One noise column per forecast column; never-observed columns carry std 0
    # and are drawn as None, so sample indexing stays aligned with FORECAST_COLUMNS.
    stds = np.array([trends[column].std for column in FORECAST_COLUMNS])
    rng = np.random.default_rng(FORECAST_SEED)
    draws = rng.standard_normal((FORECAST_SAMPLES, FORECAST_HORIZON_WEEKS, len(FORECAST_COLUMNS))) * stds
    points = []
    for horizon in range(1, FORECAST_HORIZON_WEEKS + 1):
        as_of = anchor + timedelta(weeks=horizon)
        ordered = []
        for sample in range(FORECAST_SAMPLES + 1):
            future = [
                {"week_start": anchor + timedelta(weeks=week), **_future_row(trends, draws, sample, week)}
                for week in range(1, horizon + 1)
            ]
            built = build_features([*records, *future], as_of)
            ordered.append(ordered_features(model, built, subject_code, subject_name))
        outputs = predict_batch(model, ordered)
        probabilities = [output["risk_probability"] for output in outputs]
        mid = probabilities[0]
        sampled = np.asarray(probabilities[1:])
        low, high = (
            float(value)
            for value in np.percentile(
                sampled,
                [(1 - BAND_LEVEL) / 2 * 100, (1 + BAND_LEVEL) / 2 * 100],
            )
        )
        points.append(
            {
                "week_start": as_of,
                "horizon": horizon,
                "risk_probability": mid,
                "band_low": min(low, mid),
                "band_high": max(high, mid),
            }
        )
    return points
