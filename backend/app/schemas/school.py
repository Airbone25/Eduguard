from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import AliasPath, BaseModel, ConfigDict, EmailStr, Field, SecretStr, model_validator

from app.core.enums import EnrollmentStatus
from app.schemas.auth import StrictInput, UserResponse

Name = Annotated[str, Field(min_length=1, max_length=100, pattern=r".*\S.*")]
Label = Annotated[str, Field(min_length=1, max_length=50)]
Year = Annotated[str, Field(min_length=1, max_length=30)]


class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class NewUser(StrictInput):
    email: EmailStr
    password: SecretStr = Field(min_length=12, max_length=128)
    first_name: Name
    last_name: Name


class TeacherCreate(NewUser):
    employee_code: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=40)


class StudentCreate(NewUser):
    roll_number: Name
    grade_label: Label
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=2000)
    guardian_name: str | None = Field(default=None, max_length=200)
    guardian_contact: str | None = Field(default=None, max_length=200)


class UserPatch(StrictInput):
    email: EmailStr | None = None
    first_name: Name | None = None
    last_name: Name | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def nonempty_nonnull(self):
        if not self.model_fields_set or any(
            getattr(self, f) is None for f in self.model_fields_set
        ):
            raise ValueError("Provide at least one non-null field")
        return self


class TeacherResponse(ORMResponse):
    id: UUID
    school_id: UUID
    user_id: UUID
    employee_code: str | None
    user: UserResponse


class StudentResponse(ORMResponse):
    id: UUID
    school_id: UUID
    user_id: UUID
    roll_number: str
    grade_label: str
    user: UserResponse


class ClassroomCreate(StrictInput):
    name: Name
    grade_label: Label
    academic_year: Year


class ClassroomResponse(ClassroomCreate, ORMResponse):
    id: UUID
    school_id: UUID
    is_active: bool


class SubjectCreate(StrictInput):
    code: str = Field(min_length=1, max_length=40)
    name: Name


class SubjectResponse(SubjectCreate, ORMResponse):
    id: UUID
    school_id: UUID


class CourseCreate(StrictInput):
    classroom_id: UUID
    subject_id: UUID
    academic_year: Year


class CourseResponse(CourseCreate, ORMResponse):
    id: UUID
    school_id: UUID
    is_active: bool


class TeacherAssignment(StrictInput):
    teacher_id: UUID
    is_primary: bool = False


class TeacherCourseResponse(CourseResponse):
    classroom_name: str = Field(validation_alias=AliasPath("classroom", "name"))
    subject_name: str = Field(validation_alias=AliasPath("subject", "name"))


class AssignmentResponse(TeacherAssignment, ORMResponse):
    school_id: UUID
    course_offering_id: UUID
    created_at: datetime


class StudentEnrollment(StrictInput):
    student_id: UUID
    enrolled_at: date


class EnrollmentResponse(StudentEnrollment, ORMResponse):
    id: UUID
    school_id: UUID
    course_offering_id: UUID
    status: EnrollmentStatus
