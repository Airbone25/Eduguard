from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_school_admin
from app.db.session import get_db
from app.models import User
from app.schemas.import_job import ImportReport, ImportResult
from app.services import import_service as service

router = APIRouter(prefix="/admin/imports", tags=["CSV imports"])


@router.post("/students", response_model=ImportResult, status_code=201)
def students(
    response: Response,
    file: UploadFile = File(...),
    academic_year: str = Form(..., min_length=1, max_length=30),
    enrolled_at: date | None = Form(None),
    dry_run: bool = Form(False),
    admin: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return service.execute_import(
        db,
        admin,
        file.file,
        file.filename,
        "students",
        year=academic_year,
        enrolled_at=enrolled_at,
        dry_run=dry_run,
    )


@router.post("/weekly-records", response_model=ImportResult, status_code=201)
def weekly(
    response: Response,
    file: UploadFile = File(...),
    course_offering_id: UUID = Form(...),
    dry_run: bool = Form(False),
    admin: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return service.execute_import(
        db,
        admin,
        file.file,
        file.filename,
        "weekly_records",
        course_id=course_offering_id,
        dry_run=dry_run,
    )


@router.get("", response_model=list[ImportReport])
def jobs(
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    return service.list_jobs(db, admin, limit, offset)


@router.get("/{job_id}", response_model=ImportReport)
def job(job_id: UUID, admin: User = Depends(require_school_admin), db: Session = Depends(get_db)):
    return service.get_job(db, admin, job_id)
