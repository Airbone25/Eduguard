import csv
import io
import secrets
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import BinaryIO
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import EnrollmentStatus, Role
from app.core.exceptions import APIError
from app.core.security import hash_password
from app.core.weekly_fields import COUNT_FIELDS
from app.models import (
    Classroom,
    CourseOffering,
    Enrollment,
    StudentProfile,
    Subject,
    User,
)
from app.models.import_job import ImportJob
from app.schemas.import_job import ImportReport, ImportResult, InitialCredential
from app.schemas.school import StudentCreate
from app.schemas.weekly_record import WeeklyData, WeeklyItem
from app.services.common import audit, tenant_row, transaction
from app.services.weekly_record_service import write_one

MAX_BYTES = 1024 * 1024
MAX_ROWS = 100
STUDENT_REQUIRED = {"email", "first_name", "last_name", "roll_number", "grade", "class_name"}
STUDENT_HEADERS = (set(StudentCreate.model_fields) - {"grade_label"}) | {"grade", "class_name"}
WEEKLY_REQUIRED = {"roll_number", "subject_code", "week_start"}
WEEKLY_HEADERS = WEEKLY_REQUIRED | set(WeeklyData.model_fields)


def issue(row: int, field: str, code: str, message: str) -> dict:
    return {"row_number": row, "field": field, "code": code, "message": message}


def parse_csv(
    stream: BinaryIO, allowed: set[str], required: set[str]
) -> tuple[list[dict], list[dict]]:
    content = stream.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise APIError(413, "IMPORT_TOO_LARGE", "CSV files are limited to 1 MiB and 100 data rows.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], [issue(0, "file", "INVALID_ENCODING", "Use a UTF-8 CSV file.")]
    if "\x00" in text:
        return [], [issue(0, "file", "INVALID_CSV", "CSV contains invalid characters.")]
    try:
        reader = csv.reader(io.StringIO(text, newline=""), strict=True)
        headers = [h.strip() for h in next(reader, [])]
        if (
            not headers
            or len(headers) != len(set(headers))
            or set(headers) - allowed
            or required - set(headers)
        ):
            return [], [
                issue(
                    1,
                    "headers",
                    "INVALID_HEADERS",
                    "Use the documented headers without duplicates or derived fields.",
                )
            ]
        rows, errors = [], []
        for row_number, cells in enumerate(reader, start=2):
            if len(rows) >= MAX_ROWS:
                raise APIError(
                    413, "IMPORT_TOO_LARGE", "CSV files are limited to 1 MiB and 100 data rows."
                )
            if len(cells) != len(headers):
                errors.append(
                    issue(
                        row_number, "row", "COLUMN_COUNT", "Row length does not match the header."
                    )
                )
                rows.append({})
            else:
                rows.append(
                    {
                        h: (v if h in ("password", "student_checkin_text") else v.strip())
                        for h, v in zip(headers, cells, strict=True)
                    }
                )
        if not rows:
            errors.append(issue(0, "file", "EMPTY_CSV", "Provide at least one data row."))
        return rows, errors
    except csv.Error:
        return [], [issue(0, "file", "INVALID_CSV", "CSV quoting or field size is invalid.")]


def validation_issues(row_number: int, exc: ValidationError) -> list[dict]:
    # Deliberately omit Pydantic input/context/messages: these can include credentials/PII.
    return [
        issue(
            row_number,
            ".".join(str(p) for p in e["loc"]) or "row",
            e["type"],
            "Value does not meet the field or related-count requirements.",
        )
        for e in exc.errors(include_input=False, include_context=False)
    ]


def validate_students(
    db: Session, actor: User, rows: list[dict], year: str
) -> tuple[list, list[dict]]:
    emails = {r.get("email", "").lower() for r in rows}
    rolls = {r.get("roll_number", "") for r in rows}
    existing_emails = {
        e.lower()
        for e in db.scalars(
            select(User.email).where(User.school_id == actor.school_id, User.email.in_(emails))
        )
    }
    existing_rolls = set(
        db.scalars(
            select(StudentProfile.roll_number).where(
                StudentProfile.school_id == actor.school_id, StudentProfile.roll_number.in_(rolls)
            )
        )
    )
    classrooms = defaultdict(list)
    for classroom in db.scalars(
        select(Classroom).where(
            Classroom.school_id == actor.school_id,
            Classroom.academic_year == year,
            Classroom.is_active.is_(True),
            Classroom.name.in_({r.get("class_name", "") for r in rows}),
        )
    ):
        classrooms[classroom.name].append(classroom)
    courses = defaultdict(list)
    for course in db.scalars(
        select(CourseOffering).where(
            CourseOffering.school_id == actor.school_id,
            CourseOffering.academic_year == year,
            CourseOffering.is_active.is_(True),
            CourseOffering.classroom_id.in_([c.id for group in classrooms.values() for c in group]),
        )
    ):
        courses[course.classroom_id].append(course.id)
    staged, errors, seen_emails, seen_rolls = [], [], set(), set()
    for number, raw in enumerate(rows, start=2):
        if not raw:
            continue
        generated = not raw.get("password")
        data = {
            key: value
            for key, value in raw.items()
            if key not in ("grade", "class_name") and value != ""
        }
        data["grade_label"] = raw.get("grade", "")
        if generated:
            data["password"] = secrets.token_urlsafe(24)
        try:
            student = StudentCreate.model_validate(data)
        except ValidationError as exc:
            errors.extend(validation_issues(number, exc))
            continue
        email = str(student.email).lower()
        if email in existing_emails or email in seen_emails:
            errors.append(
                issue(
                    number,
                    "email",
                    "DUPLICATE_EMAIL",
                    "Email already exists in this school or CSV.",
                )
            )
        if student.roll_number in existing_rolls or student.roll_number in seen_rolls:
            errors.append(
                issue(
                    number,
                    "roll_number",
                    "DUPLICATE_ROLL",
                    "Roll number already exists in this school or CSV.",
                )
            )
        seen_emails.add(email)
        seen_rolls.add(student.roll_number)
        matched = classrooms[raw.get("class_name", "")]
        if len(matched) != 1:
            errors.append(
                issue(
                    number,
                    "class_name",
                    "CLASS_NOT_UNIQUE",
                    "An unambiguous active class in the selected year is required.",
                )
            )
            continue
        classroom = matched[0]
        if student.grade_label != classroom.grade_label:
            errors.append(
                issue(number, "grade", "GRADE_MISMATCH", "Grade must match the selected class.")
            )
        if not courses[classroom.id]:
            errors.append(
                issue(
                    number,
                    "class_name",
                    "NO_COURSES",
                    "The selected class has no active course offerings.",
                )
            )
        staged.append((number, student, courses[classroom.id], generated))
    return staged, errors


def validate_weekly(
    db: Session, actor: User, rows: list[dict], course_id: UUID
) -> tuple[list, list[dict]]:
    course = tenant_row(db, CourseOffering, actor.school_id, course_id)
    classroom = tenant_row(db, Classroom, actor.school_id, course.classroom_id)
    subject = tenant_row(db, Subject, actor.school_id, course.subject_id)
    if not course.is_active or not classroom.is_active:
        raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
    enrolled = db.execute(
        select(StudentProfile, Enrollment.enrolled_at)
        .join(User, User.id == StudentProfile.user_id)
        .join(Enrollment, Enrollment.student_id == StudentProfile.id)
        .where(
            StudentProfile.school_id == actor.school_id,
            User.school_id == actor.school_id,
            Enrollment.school_id == actor.school_id,
            Enrollment.course_offering_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
            Enrollment.enrolled_at <= datetime.now(UTC).date(),
            User.is_active.is_(True),
            User.role == Role.STUDENT,
            StudentProfile.roll_number.in_({r.get("roll_number", "") for r in rows}),
        )
    )
    by_roll = {s.roll_number: (s, enrolled_at) for s, enrolled_at in enrolled}
    staged, errors, seen = [], [], set()
    for number, raw in enumerate(rows, start=2):
        if not raw:
            continue
        if raw.get("subject_code") != subject.code:
            errors.append(
                issue(
                    number,
                    "subject_code",
                    "SUBJECT_MISMATCH",
                    "Subject must match the selected course.",
                )
            )
        matched = by_roll.get(raw.get("roll_number"))
        if matched is None:
            errors.append(
                issue(
                    number,
                    "roll_number",
                    "STUDENT_NOT_ENROLLED",
                    "An active student enrollment in the selected course is required.",
                )
            )
            continue
        student, enrolled_at = matched
        values = {
            k: v for k, v in raw.items() if k not in ("roll_number", "subject_code") and v != ""
        }
        invalid_count = False
        for field in (*COUNT_FIELDS, "student_confidence_score"):
            if field in values:
                try:
                    values[field] = int(values[field])
                except ValueError:
                    errors.append(issue(number, field, "INVALID_INTEGER", "Use a whole number."))
                    invalid_count = True
        if invalid_count:
            continue
        try:
            item = WeeklyItem(student_id=student.id, course_offering_id=course_id, **values)
        except ValidationError as exc:
            errors.extend(validation_issues(number, exc))
            continue
        if item.week_start + timedelta(days=6) < enrolled_at:
            errors.append(
                issue(
                    number, "week_start", "WEEK_BEFORE_ENROLLMENT", "The week precedes enrollment."
                )
            )
        key = (item.student_id, item.week_start)
        if key in seen:
            errors.append(
                issue(
                    number,
                    "week_start",
                    "DUPLICATE_WEEK",
                    "The student/course/week appears more than once.",
                )
            )
        seen.add(key)
        staged.append(item)
    return staged, errors


def write_students(
    db: Session, actor: User, staged: list, enrolled_at: date
) -> list[InitialCredential]:
    users = []
    credentials = []
    for number, data, _courses, generated in staged:
        user = User(
            school_id=actor.school_id,
            email=str(data.email),
            first_name=data.first_name,
            last_name=data.last_name,
            role=Role.STUDENT,
            password_hash=hash_password(data.password.get_secret_value()),
        )
        db.add(user)
        users.append(user)
        if generated:
            credentials.append(
                InitialCredential(
                    row_number=number,
                    email=str(data.email),
                    initial_password=data.password.get_secret_value(),
                )
            )
    db.flush()
    profiles = []
    for user, (_, data, _, _) in zip(users, staged, strict=True):
        profile = StudentProfile(
            school_id=actor.school_id,
            user_id=user.id,
            **data.model_dump(exclude={"email", "password", "first_name", "last_name"}),
        )
        db.add(profile)
        profiles.append(profile)
        audit(
            db, actor, "user.created", "user", user.id, {"role": "student", "source": "csv_import"}
        )
    db.flush()
    for profile, (_, _, courses, _) in zip(profiles, staged, strict=True):
        for course_id in courses:
            enrollment = Enrollment(
                school_id=actor.school_id,
                student_id=profile.id,
                course_offering_id=course_id,
                enrolled_at=enrolled_at,
            )
            db.add(enrollment)
            db.flush()
            audit(
                db,
                actor,
                "student.enrolled",
                "enrollment",
                enrollment.id,
                {"student_id": str(profile.id), "course_offering_id": str(course_id)},
            )
    return credentials


def execute_import(
    db: Session,
    actor: User,
    stream: BinaryIO,
    filename: str | None,
    import_type: str,
    *,
    year: str | None = None,
    course_id: UUID | None = None,
    enrolled_at: date | None = None,
    dry_run: bool = False,
) -> ImportResult:
    student_import = import_type == "students"
    rows, errors = parse_csv(
        stream,
        STUDENT_HEADERS if student_import else WEEKLY_HEADERS,
        STUDENT_REQUIRED if student_import else WEEKLY_REQUIRED,
    )
    credentials = []
    with transaction(db):
        staged = []
        if not errors:
            staged, errors = (
                validate_students(db, actor, rows, year)
                if student_import
                else validate_weekly(db, actor, rows, course_id)
            )
        job = ImportJob(
            school_id=actor.school_id,
            uploaded_by=actor.id,
            filename=(filename or "upload.csv").replace("\\", "/").rsplit("/", 1)[-1][:200],
            import_type=import_type,
            status="processing",
            rows_total=len(rows),
            errors=errors,
            rows_failed=len({e["row_number"] for e in errors if e["row_number"] >= 2}),
        )
        db.add(job)
        db.flush()
        if errors:
            job.status = "validation_failed"
        elif dry_run:
            job.status = "validated"
        else:
            try:
                with db.begin_nested():
                    if student_import:
                        credentials = write_students(
                            db, actor, staged, enrolled_at or datetime.now(UTC).date()
                        )
                    else:
                        for item in sorted(
                            staged, key=lambda r: (r.student_id, r.course_offering_id, r.week_start)
                        ):
                            write_one(db, actor, item, source="csv_import")
                    db.flush()
            except IntegrityError:
                # Concurrent conflicts roll back all data/audit writes but retain the job report.
                credentials = []
                job.status = "failed"
                job.errors = [
                    issue(
                        0,
                        "file",
                        "DATA_CONFLICT",
                        "Data changed during import. No rows were imported; review and retry.",
                    )
                ]
            else:
                job.status = "succeeded"
                job.rows_succeeded = len(rows)
        job.completed_at = datetime.now(UTC)
        audit(
            db,
            actor,
            "import.executed",
            "import_job",
            job.id,
            {
                "import_type": import_type,
                "status": job.status,
                "rows_total": job.rows_total,
                "rows_succeeded": job.rows_succeeded,
            },
        )
        db.flush()
        result = ImportResult(
            **ImportReport.model_validate(job).model_dump(), initial_credentials=credentials
        )
    return result


def get_job(db: Session, actor: User, job_id: UUID) -> ImportJob:
    return tenant_row(db, ImportJob, actor.school_id, job_id)


def list_jobs(db: Session, actor: User, limit: int, offset: int) -> list[ImportJob]:
    return list(
        db.scalars(
            select(ImportJob)
            .where(ImportJob.school_id == actor.school_id)
            .order_by(ImportJob.created_at.desc(), ImportJob.id)
            .limit(limit)
            .offset(offset)
        )
    )
