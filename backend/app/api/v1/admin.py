from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_school_admin
from app.db.session import get_db
from app.models import Classroom, CourseOffering, Subject, User
from app.schemas.auth import UserResponse
from app.schemas.school import (
    AssignmentResponse,
    ClassroomCreate,
    ClassroomResponse,
    CourseCreate,
    CourseResponse,
    EnrollmentResponse,
    StudentCreate,
    StudentEnrollment,
    StudentResponse,
    SubjectCreate,
    SubjectResponse,
    TeacherAssignment,
    TeacherCreate,
    TeacherResponse,
    UserPatch,
)
from app.services import school_service as service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
def users(
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_rows(db, actor, User, limit, offset)


@router.post("/teachers", response_model=TeacherResponse, status_code=201)
def teacher(
    data: TeacherCreate, actor: User = Depends(require_school_admin), db: Session = Depends(get_db)
):
    return service.create_user(db, actor, data)


@router.post("/students", response_model=StudentResponse, status_code=201)
def student(
    data: StudentCreate, actor: User = Depends(require_school_admin), db: Session = Depends(get_db)
):
    return service.create_user(db, actor, data)


@router.patch("/users/{user_id}", response_model=UserResponse)
def patch_user(
    user_id: UUID,
    data: UserPatch,
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    return service.patch_user(db, actor, user_id, data)


@router.get("/classes", response_model=list[ClassroomResponse])
def classes(
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_rows(db, actor, Classroom, limit, offset)


@router.post("/classes", response_model=ClassroomResponse, status_code=201)
def create_class(
    data: ClassroomCreate,
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    return service.create_structure(db, actor, data)


@router.get("/subjects", response_model=list[SubjectResponse])
def subjects(
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_rows(db, actor, Subject, limit, offset)


@router.post("/subjects", response_model=SubjectResponse, status_code=201)
def create_subject(
    data: SubjectCreate, actor: User = Depends(require_school_admin), db: Session = Depends(get_db)
):
    return service.create_structure(db, actor, data)


@router.get("/course-offerings", response_model=list[CourseResponse])
def courses(
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_rows(db, actor, CourseOffering, limit, offset)


@router.post("/course-offerings", response_model=CourseResponse, status_code=201)
def create_course(
    data: CourseCreate, actor: User = Depends(require_school_admin), db: Session = Depends(get_db)
):
    return service.create_structure(db, actor, data)


@router.post(
    "/course-offerings/{course_id}/teachers", response_model=AssignmentResponse, status_code=201
)
def assign(
    course_id: UUID,
    data: TeacherAssignment,
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    return service.assign_teacher(db, actor, course_id, data)


@router.post(
    "/course-offerings/{course_id}/students", response_model=EnrollmentResponse, status_code=201
)
def enroll(
    course_id: UUID,
    data: StudentEnrollment,
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    return service.enroll_student(db, actor, course_id, data)
