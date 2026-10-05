import io
from uuid import UUID

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import (
    AuditLog,
    Classroom,
    CourseOffering,
    Enrollment,
    ImportJob,
    StudentProfile,
    User,
    WeeklyRecord,
)
from app.services import import_service

STUDENT_HEADER = "email,first_name,last_name,roll_number,grade,class_name\n"
STUDENT_ROW = "newimport@demo.edu,New,Student,I001,10,Grade 10-A\n"
WEEKLY_HEADER = (
    "roll_number,subject_code,week_start,classes_held,classes_attended,"
    "assignment_count,assignments_completed,late_submissions\n"
)


def upload(client, headers, kind, content, **fields):
    return client.post(
        f"/api/v1/admin/imports/{kind}",
        headers=headers,
        files={"file": ("records.csv", content, "text/csv")},
        data=fields,
    )


def test_student_preview_create_login_and_private_job_report(client, db, auth_headers):
    headers = auth_headers()
    original = db.scalar(select(func.count()).select_from(User))
    csv = STUDENT_HEADER + STUDENT_ROW
    preview = upload(client, headers, "students", csv, academic_year="2026", dry_run="true")
    assert preview.status_code == 201, preview.text
    assert preview.json()["status"] == "validated" and preview.json()["initial_credentials"] == []
    assert db.scalar(select(func.count()).select_from(User)) == original
    response = upload(
        client, headers, "students", csv, academic_year="2026", enrolled_at="2026-01-01"
    )
    assert response.status_code == 201, response.text
    report = response.json()
    assert report["status"] == "succeeded" and report["rows_succeeded"] == 1
    assert report["rows_failed"] == 0 and response.headers["Cache-Control"] == "no-store"
    credential = report["initial_credentials"][0]
    password = credential["initial_password"]
    user = db.scalar(select(User).where(User.email == credential["email"]))
    assert user.password_hash != password and user.password_hash.startswith("$argon2")
    student = db.scalar(select(StudentProfile).where(StudentProfile.user_id == user.id))
    assert db.scalar(select(Enrollment).where(Enrollment.student_id == student.id)) is not None
    login = client.post(
        "/api/v1/auth/login",
        json={"school_slug": "demo", "email": user.email, "password": password},
    )
    assert login.status_code == 200
    own = client.get(
        "/api/v1/student/me/progress",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert own.status_code == 200 and own.json()["student_id"] == str(student.id)
    for path in (f"/api/v1/admin/imports/{report['id']}", "/api/v1/admin/imports"):
        saved = client.get(path, headers=headers)
        assert saved.status_code == 200
        assert password not in saved.text and "initial_credentials" not in saved.text
    assert password not in str(db.scalars(select(AuditLog.details)).all())
    assert password not in str(db.get(ImportJob, UUID(report["id"])).errors)


def test_student_validation_is_atomic_and_never_echoes_secrets(client, db, auth_headers):
    headers = auth_headers()
    before = db.scalar(select(func.count()).select_from(User))
    content = STUDENT_HEADER + STUDENT_ROW + STUDENT_ROW.replace("I001", "I002")
    response = upload(client, headers, "students", content, academic_year="2026").json()
    assert response["status"] == "validation_failed" and response["rows_succeeded"] == 0
    assert response["errors"][0]["row_number"] == 3
    assert response["errors"][0]["code"] == "DUPLICATE_EMAIL"
    assert db.scalar(select(func.count()).select_from(User)) == before
    invalid = STUDENT_HEADER.rstrip() + ",password\n" + STUDENT_ROW.rstrip() + ",tinysecret\n"
    failed = upload(client, headers, "students", invalid, academic_year="2026")
    assert failed.json()["status"] == "validation_failed"
    assert "tinysecret" not in failed.text and failed.json()["errors"][0]["field"] == "password"


def test_student_import_duplicate_existing_and_ambiguous_class(client, db, demo, auth_headers):
    headers = auth_headers()
    existing = STUDENT_HEADER + STUDENT_ROW.replace(
        "newimport@demo.edu", "STUDENT@DEMO.EDU"
    ).replace("I001", "S001")
    response = upload(client, headers, "students", existing, academic_year="2026").json()
    assert {e["code"] for e in response["errors"]} == {"DUPLICATE_EMAIL", "DUPLICATE_ROLL"}
    db.add(Classroom(school_id=demo.id, name="Grade 10-A", grade_label="10", academic_year="2026"))
    db.flush()
    response = upload(
        client, headers, "students", STUDENT_HEADER + STUDENT_ROW, academic_year="2026"
    ).json()
    assert any(e["code"] == "CLASS_NOT_UNIQUE" for e in response["errors"])
    assert response["rows_succeeded"] == 0


def test_weekly_import_source_upsert_and_history(client, db, auth_headers):
    course = db.scalar(select(CourseOffering))
    headers = auth_headers()
    content = WEEKLY_HEADER + "S001,MATH,2026-01-05,10,8,4,4,0\nS001,MATH,2026-01-12,10,9,4,3,1\n"
    response = upload(client, headers, "weekly-records", content, course_offering_id=str(course.id))
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "succeeded" and response.json()["rows_succeeded"] == 2
    rows = db.scalars(select(WeeklyRecord).order_by(WeeklyRecord.week_start)).all()
    assert len(rows) == 2 and all(row.source == "csv_import" for row in rows)
    assert rows[0].classes_attended == 8 and rows[1].assignments_completed == 3
    updated = upload(
        client,
        headers,
        "weekly-records",
        WEEKLY_HEADER + "S001,MATH,2026-01-05,10,7,4,4,0\n",
        course_offering_id=str(course.id),
    ).json()
    assert updated["status"] == "succeeded"
    assert db.scalar(select(func.count()).select_from(WeeklyRecord)) == 2
    db.refresh(rows[0])
    assert rows[0].classes_attended == 7 and rows[1].classes_attended == 9
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.entity_type == "weekly_record")
        )
        == 3
    )


def test_weekly_errors_all_or_nothing_and_duplicates(client, db, auth_headers):
    course = db.scalar(select(CourseOffering))
    headers = auth_headers()
    for content, code in [
        ("S001,MATH,2026-01-05,10,8,4,4,0\nS001,MATH,2026-01-12,10,11,4,4,0\n", "value_error"),
        ("S001,MATH,2026-01-05,10,8,4,4,0\nS001,MATH,2026-01-05,10,9,4,4,0\n", "DUPLICATE_WEEK"),
        ("S001,MATH,2026-01-05,no,8,4,4,0\n", "INVALID_INTEGER"),
        ("S001,PHY,2026-01-05,10,8,4,4,0\n", "SUBJECT_MISMATCH"),
        ("S001,MATH,2025-12-01,10,8,4,4,0\n", "WEEK_BEFORE_ENROLLMENT"),
    ]:
        result = upload(
            client,
            headers,
            "weekly-records",
            WEEKLY_HEADER + content,
            course_offering_id=str(course.id),
        ).json()
        assert result["status"] == "validation_failed", result
        assert result["rows_succeeded"] == 0 and any(e["code"] == code for e in result["errors"])
        assert db.scalar(select(func.count()).select_from(WeeklyRecord)) == 0


def test_import_permissions_and_tenant_resolution(client, db, demo, school_b, auth_headers):
    course = db.scalar(select(CourseOffering).where(CourseOffering.school_id == demo.id))
    own = auth_headers()
    content = WEEKLY_HEADER + "B001,HIST,2026-01-05,10,8,4,4,0\n"
    assert (
        upload(
            client, own, "weekly-records", content, course_offering_id=str(school_b["course"].id)
        ).status_code
        == 404
    )
    bad_roll = upload(
        client,
        own,
        "weekly-records",
        content.replace("HIST", "MATH"),
        course_offering_id=str(course.id),
    ).json()
    assert bad_roll["errors"][0]["code"] == "STUDENT_NOT_ENROLLED"
    for role in ("teacher", "student"):
        headers = auth_headers(role)
        assert (
            upload(
                client, headers, "students", STUDENT_HEADER + STUDENT_ROW, academic_year="2026"
            ).status_code
            == 403
        )
        assert (
            upload(
                client, headers, "weekly-records", content, course_offering_id=str(course.id)
            ).status_code
            == 403
        )
        assert client.get("/api/v1/admin/imports", headers=headers).status_code == 403
        assert (
            client.get(f"/api/v1/admin/imports/{bad_roll['id']}", headers=headers).status_code
            == 403
        )
    outsider = auth_headers("admin", "school-b")
    assert (
        client.get(f"/api/v1/admin/imports/{bad_roll['id']}", headers=outsider).status_code == 404
    )
    assert client.get("/api/v1/admin/imports", headers=outsider).json() == []
    assert db.scalar(select(func.count()).select_from(WeeklyRecord)) == 0


def test_import_conflict_rolls_back_all_rows_and_retains_report(
    client, db, auth_headers, monkeypatch
):
    course = db.scalar(select(CourseOffering))
    original = import_service.write_one
    calls = 0

    def conflicting_write(*args, **kwargs):
        nonlocal calls
        row = original(*args, **kwargs)
        calls += 1
        if calls == 2:
            raise IntegrityError("simulated concurrent conflict", {}, Exception())
        return row

    monkeypatch.setattr(import_service, "write_one", conflicting_write)
    content = WEEKLY_HEADER + "S001,MATH,2026-01-05,10,8,4,4,0\nS001,MATH,2026-01-12,10,9,4,4,0\n"
    response = upload(
        client, auth_headers(), "weekly-records", content, course_offering_id=str(course.id)
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "failed" and response.json()["rows_succeeded"] == 0
    assert response.json()["errors"][0]["code"] == "DATA_CONFLICT"
    assert db.scalar(select(func.count()).select_from(WeeklyRecord)) == 0
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.entity_type == "weekly_record")
        )
        == 0
    )
    assert db.scalar(select(func.count()).select_from(ImportJob)) == 1


@pytest.mark.parametrize(
    "content,code",
    [
        (b"\xff", "INVALID_ENCODING"),
        (b"", "INVALID_HEADERS"),
        (b"roll_number,roll_number,subject_code,week_start\n", "INVALID_HEADERS"),
        (
            b"roll_number,subject_code,week_start,At_Risk\nS001,MATH,2026-01-05,1\n",
            "INVALID_HEADERS",
        ),
        (b"roll_number,subject_code,week_start\nS001,MATH\n", "COLUMN_COUNT"),
        (b'roll_number,subject_code,week_start\n"unclosed', "INVALID_CSV"),
        (b"roll_number,subject_code,week_start\n", "EMPTY_CSV"),
    ],
)
def test_csv_parser_errors(content, code):
    _, errors = import_service.parse_csv(
        io.BytesIO(content), import_service.WEEKLY_HEADERS, import_service.WEEKLY_REQUIRED
    )
    assert errors[0]["code"] == code


def test_csv_size_limits_and_bom():
    from app.core.exceptions import APIError

    for content in (
        b"a" * (import_service.MAX_BYTES + 1),
        (WEEKLY_HEADER + "S001,MATH,2026-01-05,10,8,4,4,0\n" * 101).encode(),
    ):
        with pytest.raises(APIError) as exc:
            import_service.parse_csv(
                io.BytesIO(content), import_service.WEEKLY_HEADERS, import_service.WEEKLY_REQUIRED
            )
        assert exc.value.status_code == 413
    data = "\ufeff" + WEEKLY_HEADER + "S001,MATH,2026-01-05,10,8,4,4,0\n"
    rows, errors = import_service.parse_csv(
        io.BytesIO(data.encode()), import_service.WEEKLY_HEADERS, import_service.WEEKLY_REQUIRED
    )
    assert len(rows) == 1 and not errors
