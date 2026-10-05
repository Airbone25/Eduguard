from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.auth import StrictInput
from app.schemas.school import ORMResponse

Count = Annotated[int, Field(ge=0, le=1000000, strict=True)]
Measure = Annotated[Decimal, Field(ge=0, le=1000000, decimal_places=4, allow_inf_nan=False)]
Score = Annotated[Decimal, Field(ge=0, le=100, decimal_places=4, allow_inf_nan=False)]


class WeeklyData(StrictInput):
    classes_held: Count | None = None
    classes_attended: Count | None = None
    study_hours_weekly: Annotated[Decimal, Field(ge=0, le=168, decimal_places=4)] | None = None
    assessment_avg_score: Score | None = None
    assessment_count: Count | None = None
    assignment_count: Count | None = None
    assignments_completed: Count | None = None
    late_submissions: Count | None = None
    last_minute_submissions: Count | None = None
    avg_submission_delay_days: Measure | None = None
    assignment_avg_score: Score | None = None
    quiz_count: Count | None = None
    quiz_attempt_count: Count | None = None
    quiz_avg_score: Score | None = None
    lms_login_count: Count | None = None
    lms_active_days: Annotated[int, Field(ge=0, le=7, strict=True)] | None = None
    avg_lms_session_min: Measure | None = None
    total_lms_time_min: Measure | None = None
    days_since_last_login: Count | None = None
    participation_count: Count | None = None
    participation_opportunities: Count | None = None
    student_confidence_score: Annotated[int, Field(ge=1, le=5, strict=True)] | None = None
    student_checkin_text: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def count_relationships(self):
        for child, parent in [
            ("classes_attended", "classes_held"),
            ("late_submissions", "assignment_count"),
            ("assignments_completed", "assignment_count"),
            ("late_submissions", "assignments_completed"),
            ("last_minute_submissions", "assignment_count"),
            ("participation_count", "participation_opportunities"),
        ]:
            small, large = getattr(self, child), getattr(self, parent)
            if small is not None and large is not None and small > large:
                raise ValueError(f"{child} cannot exceed {parent}")
        return self


class WeeklyPut(WeeklyData):
    course_offering_id: UUID


class WeeklyItem(WeeklyPut):
    student_id: UUID
    week_start: date

    @model_validator(mode="after")
    def monday(self):
        if self.week_start.weekday() != 0:
            raise ValueError("week_start must be a Monday")
        return self


class WeeklyBatch(StrictInput):
    records: list[WeeklyItem] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def distinct_keys(self):
        keys = {(r.student_id, r.course_offering_id, r.week_start) for r in self.records}
        if len(keys) != len(self.records):
            raise ValueError("Batch contains duplicate student/course/week keys")
        return self


class WeeklyResponse(WeeklyItem, ORMResponse):
    id: UUID
    school_id: UUID
    source: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime
