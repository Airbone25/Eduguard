from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.db.session import get_db
from app.models import User
from app.schemas.alert import AlertFeed
from app.schemas.dashboard import DashboardSort, RiskSummary
from app.schemas.progress import StudentProgress
from app.services.alert_service import alert_feed
from app.services.dashboard_service import risk_summary
from app.services.student_progress_service import teacher_progress

router = APIRouter(prefix="/teacher", tags=["teacher dashboard"])


@router.get("/alerts", response_model=AlertFeed)
def alerts(
    as_of_date: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return alert_feed(db, teacher, as_of_date or datetime.now(UTC).date(), limit, offset)


@router.get("/students/{student_id}/progress", response_model=StudentProgress)
def progress(
    student_id: UUID,
    course_offering_id: UUID,
    as_of_date: date | None = None,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return teacher_progress(
        db, teacher, student_id, course_offering_id, as_of_date or datetime.now(UTC).date()
    )


@router.get("/classes/{course_id}/risk-summary", response_model=RiskSummary)
def summary(
    course_id: UUID,
    as_of_date: date | None = None,
    sort: DashboardSort = "attention",
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return risk_summary(
        db, teacher, course_id, as_of_date or datetime.now(UTC).date(), sort, limit, offset
    )
