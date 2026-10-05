from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.enums import InterventionStatus, InterventionUpdateKind
from app.schemas.auth import StrictInput
from app.schemas.school import ORMResponse

GoalTarget = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
GOAL_KEYS = {"assessment_avg_score_target", "attendance_target"}
Title = Annotated[str, Field(min_length=1, max_length=200, pattern=r".*\S.*")]


def validate_goals(value: dict) -> dict:
    if set(value) - GOAL_KEYS:
        raise ValueError("Use supported goal targets")
    for target in value.values():
        if not isinstance(target, (int, float)) or isinstance(target, bool):
            raise ValueError("Goal targets must be numbers")
    return value


class InterventionCreate(StrictInput):
    frequency: str | None = Field(default=None, max_length=200)
    course_offering_id: UUID
    title: Title
    start_date: date
    template_id: UUID | None = None
    prediction_id: UUID | None = None
    review_date: date | None = None
    visibility_to_student: bool = False
    goal_definition: dict[str, GoalTarget] = Field(default_factory=dict)
    status: InterventionStatus = InterventionStatus.PLANNED

    @field_validator("goal_definition")
    @classmethod
    def supported_goals(cls, value):
        return validate_goals(value)

    @model_validator(mode="after")
    def validate_window(self):
        if self.review_date is not None and self.review_date < self.start_date:
            raise ValueError("review_date cannot precede start_date")
        if self.status is InterventionStatus.COMPLETED:
            raise ValueError("Create an intervention in an open state")
        return self


class InterventionPatch(StrictInput):
    frequency: str | None = Field(default=None, max_length=200)
    title: Title | None = None
    review_date: date | None = None
    status: InterventionStatus | None = None
    visibility_to_student: bool | None = None
    goal_definition: dict[str, GoalTarget] | None = None

    @model_validator(mode="after")
    def validate_patch(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} may not be null")
        if self.goal_definition is not None:
            validate_goals(self.goal_definition)
        return self


class InterventionUpdateCreate(StrictInput):
    note: Annotated[str, Field(min_length=1, max_length=5000, pattern=r".*\S.*")]


class InterventionResponse(ORMResponse):
    frequency: str | None = None
    id: UUID
    school_id: UUID
    student_id: UUID
    course_offering_id: UUID
    template_id: UUID | None
    prediction_id: UUID | None
    title: str
    status: InterventionStatus
    start_date: date
    review_date: date | None
    completed_at: datetime | None
    visibility_to_student: bool
    goal_definition: dict
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class InterventionUpdateResponse(BaseModel):
    id: UUID
    intervention_id: UUID
    author_user_id: UUID
    sequence: int
    kind: InterventionUpdateKind
    note: str | None
    details: dict
    created_at: datetime
