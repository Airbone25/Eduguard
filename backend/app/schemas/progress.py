from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import InterventionStatus
from app.schemas.dashboard import Trend


class CourseInfo(BaseModel):
    id: UUID
    classroom_name: str
    subject_name: str
    subject_code: str
    academic_year: str


class ProgressMetric(BaseModel):
    current: float | None
    change_4wk: float | None
    trend: Trend


class AssignmentProgress(BaseModel):
    total: int | None
    completed: int | None
    completion_percent: float | None
    on_time_streak_weeks: int | None


class ProgressEvent(BaseModel):
    code: Literal["attendance_improvement", "score_improvement", "on_time_submission_streak"]
    value: float


class WeeklyProgress(BaseModel):
    week_start: date
    attendance_percent: float | None
    assessment_avg_score: float | None
    assignment_count: int | None
    assignments_completed: int | None
    late_submissions: int | None


class CourseProgress(BaseModel):
    course: CourseInfo
    attendance: ProgressMetric
    academic: ProgressMetric
    assignments: AssignmentProgress
    improvements: list[ProgressEvent]
    weeks: list[WeeklyProgress]


class StudentProgress(BaseModel):
    student_id: UUID
    as_of_date: date
    courses: list[CourseProgress]


class GoalTargets(BaseModel):
    # Deliberately whitelist keys rather than serialize arbitrary stored JSON.
    attendance_target: float | None = Field(default=None, ge=0, le=100)
    assessment_avg_score_target: float | None = Field(default=None, ge=0, le=100)


class VisibleIntervention(BaseModel):
    id: UUID
    course_offering_id: UUID
    title: str
    status: InterventionStatus
    start_date: date
    review_date: date | None
    completed_at: datetime | None
    goal_definition: GoalTargets


class StudentGoal(BaseModel):
    intervention_id: UUID
    course_offering_id: UUID
    title: str
    targets: GoalTargets


class StudentDashboard(StudentProgress):
    visible_interventions: list[VisibleIntervention]
    interventions_has_more: bool
    goals: list[StudentGoal]
