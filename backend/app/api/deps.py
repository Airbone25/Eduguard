from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.enums import Role
from app.core.exceptions import APIError
from app.core.permissions import authorized_student, teacher_has_course_access
from app.core.security import decode_token
from app.db.session import get_db
from app.models import StudentProfile, User
from app.services.auth_service import active_session, active_user

bearer = HTTPBearer(auto_error=False, description="Paste the access_token returned by /auth/login.")


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise APIError(401, "AUTHENTICATION_REQUIRED", "Bearer authentication required.")
    claims = decode_token(credentials.credentials, "access")
    user = active_user(db, claims)
    active_session(db, user, claims)
    request.state.user_id = str(user.id)
    request.state.school_id = str(user.school_id)
    return user


def require_role(*roles: Role) -> Callable:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise APIError(403, "ROLE_FORBIDDEN", "This role cannot perform this action.")
        return user

    return dependency


require_school_admin = require_role(Role.SCHOOL_ADMIN)
require_teacher = require_role(Role.TEACHER)
require_student = require_role(Role.STUDENT)


def require_teacher_student_access(
    student_id: UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> StudentProfile:
    return authorized_student(db, user, student_id)


def require_teacher_course_access(
    course_id: UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> UUID:
    if not teacher_has_course_access(db, user, course_id):
        raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
    return course_id
