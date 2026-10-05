from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.core.enums import InterventionStatus
from app.db.session import get_db
from app.models import User
from app.schemas.intervention import (
    InterventionCreate,
    InterventionPatch,
    InterventionResponse,
    InterventionUpdateCreate,
    InterventionUpdateResponse,
)
from app.services import intervention_service as service

router = APIRouter(prefix="/teacher", tags=["interventions"])


@router.get("/interventions", response_model=list[InterventionResponse])
def teacher_interventions(
    course_offering_id: UUID | None = None,
    status: InterventionStatus | None = None,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.teacher_interventions(db, teacher, course_offering_id, status, limit, offset)


@router.post(
    "/students/{student_id}/interventions", response_model=InterventionResponse, status_code=201
)
def create_intervention(
    student_id: UUID,
    data: InterventionCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return service.create_intervention(db, teacher, student_id, data)


@router.get("/students/{student_id}/interventions", response_model=list[InterventionResponse])
def interventions(
    student_id: UUID,
    course_offering_id: UUID | None = None,
    status: InterventionStatus | None = None,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_interventions(
        db, teacher, student_id, course_offering_id, status, limit, offset
    )


@router.get("/interventions/{intervention_id}", response_model=InterventionResponse)
def intervention(
    intervention_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return service.get_intervention(db, teacher, intervention_id)


@router.patch("/interventions/{intervention_id}", response_model=InterventionResponse)
def patch_intervention(
    intervention_id: UUID,
    data: InterventionPatch,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return service.patch_intervention(db, teacher, intervention_id, data)


@router.post(
    "/interventions/{intervention_id}/updates",
    response_model=InterventionUpdateResponse,
    status_code=201,
)
def add_update(
    intervention_id: UUID,
    data: InterventionUpdateCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return service.add_update(db, teacher, intervention_id, data.note)


@router.get(
    "/interventions/{intervention_id}/updates", response_model=list[InterventionUpdateResponse]
)
def updates(
    intervention_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_updates(db, teacher, intervention_id, limit, offset)


@router.post("/interventions/{intervention_id}/complete", response_model=InterventionResponse)
def complete_intervention(
    intervention_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return service.complete_intervention(db, teacher, intervention_id)
