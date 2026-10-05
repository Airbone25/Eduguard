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
