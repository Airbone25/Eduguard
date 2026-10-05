from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.core.exceptions import APIError
from app.db.session import get_db
from app.models import User
from app.schemas.weekly_record import WeeklyBatch, WeeklyItem, WeeklyPut, WeeklyResponse
from app.services import weekly_record_service as service

router = APIRouter(prefix="/teacher", tags=["weekly records"])


@router.put("/students/{student_id}/weekly-records/{week_start}", response_model=WeeklyResponse)
def put_record(
    student_id: UUID,
    week_start: date,
    data: WeeklyPut,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if week_start.weekday() != 0:
        raise APIError(422, "INVALID_WEEK_START", "week_start must be a Monday.")
    item = WeeklyItem(student_id=student_id, week_start=week_start, **data.model_dump())
    return service.save_records(db, teacher, [item])[0]


@router.get("/students/{student_id}/weekly-records", response_model=list[WeeklyResponse])
def get_records(
    student_id: UUID,
    course_offering_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return service.list_records(
        db, teacher, student_id, course_offering_id, date_from, date_to, limit, offset
    )


@router.post("/weekly-records/batch", response_model=list[WeeklyResponse])
def batch(
    data: WeeklyBatch, teacher: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    return service.save_records(db, teacher, data.records)
