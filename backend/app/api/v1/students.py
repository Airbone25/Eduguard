from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_student
from app.db.session import get_db
from app.models import User
from app.schemas.progress import StudentDashboard, StudentGoal, StudentProgress, VisibleIntervention
from app.services import student_progress_service as service

router = APIRouter(prefix="/student/me", tags=["student progress"])


@router.get("/dashboard", response_model=StudentDashboard)
def dashboard(
    course_offering_id: UUID | None = None,
    as_of_date: date | None = None,
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return service.dashboard(
        db, student, course_offering_id, as_of_date or datetime.now(UTC).date()
    )


@router.get("/progress", response_model=StudentProgress)
def progress(
    course_offering_id: UUID | None = None,
    as_of_date: date | None = None,
    history_weeks: int = Query(8, ge=1, le=52),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return service.progress(
        db, student, course_offering_id, as_of_date or datetime.now(UTC).date(), history_weeks
    )


@router.get("/interventions", response_model=list[VisibleIntervention])
def interventions(
    course_offering_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return service.visible_interventions(db, student, course_offering_id, limit, offset)


@router.get("/goals", response_model=list[StudentGoal])
def goals(
    course_offering_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return service.goals(
        service.visible_interventions(db, student, course_offering_id, limit, offset)
    )
