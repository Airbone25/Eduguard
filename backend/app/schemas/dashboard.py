from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.school import CourseResponse

Trend = Literal["improving", "stable", "declining", "insufficient_history"]
SupportLevel = Literal["priority_support", "watch", "doing_well", "not_assessed"]
DashboardSort = Literal["attention", "name", "attendance", "score"]


class DashboardStudent(BaseModel):
    student_id: UUID
    name: str
    roll_number: str
    support_level: SupportLevel
    prediction_as_of_date: date | None
    trajectory: Trend
    newly_declining: bool
    latest_score: float | None
    attendance: float | None
    top_signal: str | None
    active_intervention: bool


class DashboardCounts(BaseModel):
    students: int
    priority_support: int
    watch: int
    doing_well: int
    not_assessed: int
    newly_declining: int


class RiskSummary(BaseModel):
    course: CourseResponse
    as_of_date: date
    counts: DashboardCounts
    students: list[DashboardStudent]
    limit: int
    offset: int
