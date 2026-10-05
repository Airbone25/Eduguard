from pydantic import Field, model_validator

from app.core.enums import EnrollmentStatus
from app.schemas.auth import StrictInput
from app.schemas.school import Name, ORMResponse


class Patch(StrictInput):
    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set or any(
            getattr(self, f) is None for f in self.model_fields_set
        ):
            raise ValueError("Provide at least one non-null field")
        return self


class ClassroomPatch(Patch):
    name: Name | None = None
    is_active: bool | None = None


class SubjectPatch(Patch):
    name: Name | None = None


class CoursePatch(Patch):
    is_active: bool | None = None


class EnrollmentPatch(StrictInput):
    status: EnrollmentStatus


class SchoolPatch(StrictInput):
    name: str = Field(min_length=1, max_length=200, pattern=r".*\S.*")


class SchoolResponse(ORMResponse):
    name: str
    slug: str
    domain: str | None
