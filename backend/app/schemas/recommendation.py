from typing import Annotated
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.auth import StrictInput
from app.schemas.school import ORMResponse

Weight = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]


class TemplateCreate(StrictInput):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    tags: dict[str, Weight]
    default_duration_days: int | None = Field(default=None, ge=1, le=365)
    is_active: bool = True

    @field_validator("tags")
    @classmethod
    def supported_factors(cls, value):
        if not value or set(value) - {
            "attendance",
            "avg_score",
            "late_submissions",
            "study_hours",
            "participation",
            "lms",
        }:
            raise ValueError("Use supported recommendation factors")
        return value


class TemplatePatch(StrictInput):
    description: str | None = Field(default=None, min_length=1, max_length=5000)
    tags: dict[str, Weight] | None = None
    default_duration_days: int | None = Field(default=None, ge=1, le=365)
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_patch(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field")
        for field in self.model_fields_set - {"default_duration_days"}:
            if getattr(self, field) is None:
                raise ValueError("Only duration may be null")
        if self.tags is not None:
            TemplateCreate.supported_factors(self.tags)
        return self


class TemplateResponse(TemplateCreate, ORMResponse):
    id: UUID
    school_id: UUID | None
