from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.auth import StrictInput


class PredictionRequest(StrictInput):
    course_offering_id: UUID
    as_of_date: date


class ClassPredictionRequest(StrictInput):
    as_of_date: date


class Signal(BaseModel):
    code: str
    factor: str
    direction: str
    severity: float = Field(ge=0, le=1)
    message: str


class Recommendation(BaseModel):
    template_id: UUID
    name: str
    match_score: float
    reason: str


class FeatureContribution(BaseModel):
    name: str
    value: float | None
    contribution: float


class WhatIfRequest(StrictInput):
    prediction_id: UUID
    overrides: dict[str, float]


class WhatIfResponse(BaseModel):
    prediction_id: UUID
    baseline_probability: float
    baseline_support_level: Literal["doing_well", "watch", "priority_support"]
    probability: float
    support_level: Literal["doing_well", "watch", "priority_support"]
    delta: float
    applied_overrides: dict[str, float]


class ForecastPoint(BaseModel):
    week_start: date
    horizon: int = Field(ge=1, le=52)
    risk_probability: float
    band_low: float
    band_high: float


class ForecastResponse(BaseModel):
    student_id: UUID
    course_offering_id: UUID
    as_of_date: date
    history_weeks: int
    horizon_weeks: int
    band_level: float
    model_version: str
    method: str
    points: list[ForecastPoint]


class PredictionResponse(BaseModel):
    id: UUID
    student_id: UUID
    course_offering_id: UUID
    as_of_date: date
    created_at: datetime
    model_version_id: UUID
    model_version: str
    feature_snapshot_id: UUID
    feature_version: str
    risk_probability: float
    risk_level: Literal["low", "medium", "high"]
    at_risk: bool
    support_level: Literal["doing_well", "watch", "priority_support"]
    signals: list[Signal]
    recommendations: list[Recommendation]
    contributions: list[FeatureContribution]
