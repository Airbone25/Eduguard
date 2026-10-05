from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.db.session import get_db
from app.models import User
from app.schemas.school import StudentResponse, TeacherCourseResponse
from app.services import teacher_service as service

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/classes", response_model=list[TeacherCourseResponse])
def classes(
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_courses(db, teacher, limit, offset)


@router.get("/classes/{course_id}/students", response_model=list[StudentResponse])
def students(
    course_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_students(db, teacher, course_id, limit, offset)


@router.get("/students/{student_id}", response_model=StudentResponse)
def student(
    student_id: UUID, teacher: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    return service.student_detail(db, teacher, student_id)
