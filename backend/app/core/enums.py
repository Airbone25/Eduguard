from enum import StrEnum


class Role(StrEnum):
    SCHOOL_ADMIN = "school_admin"
    TEACHER = "teacher"
    STUDENT = "student"


class EnrollmentStatus(StrEnum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    COMPLETED = "completed"


class InterventionStatus(StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InterventionUpdateKind(StrEnum):
    CREATED = "created"
    NOTE = "note"
    STATUS_CHANGE = "status_change"
    COMPLETED = "completed"
