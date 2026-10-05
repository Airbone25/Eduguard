from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.school import ORMResponse


class ImportErrorDetail(BaseModel):
    row_number: int
    field: str
    code: str
    message: str


class ImportReport(ORMResponse):
    id: UUID
    filename: str
    import_type: Literal["students", "weekly_records"]
    status: Literal["processing", "validated", "validation_failed", "succeeded", "failed"]
    rows_total: int
    rows_succeeded: int
    rows_failed: int
    errors: list[ImportErrorDetail]
    created_at: datetime
    completed_at: datetime | None


class InitialCredential(BaseModel):
    row_number: int
    email: str
    initial_password: str


class ImportResult(ImportReport):
    # Returned once, to the initiating admin. Never stored in the job/audit log.
    initial_credentials: list[InitialCredential] = Field(default_factory=list)
