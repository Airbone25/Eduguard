from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.prediction import Signal
from app.schemas.school import CourseResponse

AlertKind = Literal["declining", "needs_support", "new_data", "improving"]


class AlertItem(BaseModel):
    student_id: UUID
    name: str
    roll_number: str
    course_offering_id: UUID
    course: CourseResponse
    course_label: str
    prediction_id: UUID
    as_of_date: date
    risk_probability: float
    previous_probability: float | None
    probability_delta: float | None
    risk_level: Literal["low", "medium", "high"]
    at_risk: bool
    support_level: Literal["doing_well", "watch", "priority_support"]
    top_signals: list[Signal]
    recommendation_name: str | None
    active_intervention: bool
    kind: AlertKind


class AlertCounts(BaseModel):
    total: int = 0
    declining: int = 0
    needs_support: int = 0
    new_data: int = 0
    improving: int = 0


class AlertFeed(BaseModel):
    as_of_date: date
    counts: AlertCounts
    alerts: list[AlertItem]
    limit: int
    offset: int
