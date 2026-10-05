from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import require_school_admin
from app.db.session import get_db
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    StudentProfile,
    Subject,
    TeacherProfile,
    User,
)
from app.schemas.management import (
    ClassroomPatch,
    CoursePatch,
    EnrollmentPatch,
    SchoolPatch,
    SchoolResponse,
    SubjectPatch,
)
from app.schemas.school import (
    AssignmentResponse,
    ClassroomResponse,
    CourseResponse,
    EnrollmentResponse,
    StudentResponse,
    SubjectResponse,
    TeacherResponse,
)
from app.services import management_service as service

router = APIRouter(prefix="/admin", tags=["admin management"])
Admin = Annotated[User, Depends(require_school_admin)]
DB = Annotated[Session, Depends(get_db)]
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]


@router.get("/teachers", response_model=list[TeacherResponse])
def teachers(actor: Admin, db: DB, limit: Limit = 100, offset: Offset = 0):
    return service.profiles(db, actor, TeacherProfile, limit, offset)


@router.get("/students", response_model=list[StudentResponse])
def students(actor: Admin, db: DB, limit: Limit = 100, offset: Offset = 0):
    return service.profiles(db, actor, StudentProfile, limit, offset)


@router.patch("/classes/{row_id}", response_model=ClassroomResponse)
def classroom(row_id: UUID, data: ClassroomPatch, actor: Admin, db: DB):
    return service.patch_structure(db, actor, Classroom, row_id, data)


@router.patch("/subjects/{row_id}", response_model=SubjectResponse)
def subject(row_id: UUID, data: SubjectPatch, actor: Admin, db: DB):
    return service.patch_structure(db, actor, Subject, row_id, data)


@router.patch("/course-offerings/{row_id}", response_model=CourseResponse)
def course(row_id: UUID, data: CoursePatch, actor: Admin, db: DB):
    return service.patch_structure(db, actor, CourseOffering, row_id, data)


@router.get("/course-offerings/{course_id}/teachers", response_model=list[AssignmentResponse])
def assignments(course_id: UUID, actor: Admin, db: DB, limit: Limit = 100, offset: Offset = 0):
    return service.course_members(db, actor, course_id, CourseTeacher, limit, offset)


@router.get("/course-offerings/{course_id}/students", response_model=list[EnrollmentResponse])
def enrollments(course_id: UUID, actor: Admin, db: DB, limit: Limit = 100, offset: Offset = 0):
    return service.course_members(db, actor, course_id, Enrollment, limit, offset)


@router.delete("/course-offerings/{course_id}/teachers/{teacher_id}", status_code=204)
def unassign(course_id: UUID, teacher_id: UUID, actor: Admin, db: DB):
    service.unassign(db, actor, course_id, teacher_id)
    return Response(status_code=204)


@router.patch("/enrollments/{row_id}", response_model=EnrollmentResponse)
def enrollment(row_id: UUID, data: EnrollmentPatch, actor: Admin, db: DB):
    return service.enrollment_status(db, actor, row_id, data.status)


@router.get("/settings", response_model=SchoolResponse)
def settings(actor: Admin, db: DB):
    return service.school(db, actor)


@router.patch("/settings", response_model=SchoolResponse)
def patch_settings(data: SchoolPatch, actor: Admin, db: DB):
    return service.school(db, actor, data)
