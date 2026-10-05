# CSV imports

Only school admins can import or read import reports. All records and lookups are scoped to
the authenticated school. Use multipart form uploads (`file`), UTF-8 CSV (BOM accepted),
at most **1 MiB / 100 data rows** per request. Example files are in `examples/`.

## Students

`POST /api/v1/admin/imports/students`

Form fields: `file`, required `academic_year`, optional `enrolled_at` (defaults to today's UTC
date), and optional `dry_run` (default false).

Required CSV headers:

```csv
email,first_name,last_name,roll_number,grade,class_name
```

Optional headers: `password`, `phone`, `address`, `guardian_name`, `guardian_contact`.
The class must resolve uniquely to an active classroom in the selected school/year; grade must
match. Students are enrolled in all existing active course offerings for that classroom/year.
No class, subject or course is invented. Existing/duplicate school emails or roll numbers fail
validation; email comparison is case-insensitive. Imports create students, never overwrite users.

If `password` is provided, normal 12–128 character validation applies. Otherwise, a unique
random password is generated. Generated credentials are returned **once** in the successful
POST response's `initial_credentials`. The response has `Cache-Control: no-store`. Save them
for the school's normal account-onboarding process. Passwords are hashed with Argon2 and are
never stored in ImportJob, validation reports, or audit details. GET reports cannot recover them.
Provided passwords are not echoed back. No messages/emails are sent automatically.

## Weekly records

`POST /api/v1/admin/imports/weekly-records`

Form fields: `file`, required `course_offering_id`, optional `dry_run`.

Required CSV headers:

```csv
roll_number,subject_code,week_start
```

Additional columns are the raw fields documented by the weekly-record schema in Swagger,
including optional `assignments_completed`. Derived features, risk labels, `school_id`, IDs
and `source` columns are rejected. Subject must match the selected course; roll number must
resolve to an active enrolled student in that school/course. This explicit context avoids
ambiguity when a subject is offered in multiple classes or academic years.

Weeks must start on Monday and cannot precede enrollment. All weekly field/range/related-count
validation applies. Duplicate student/course/week entries within a file fail validation.
Existing rows for those keys are replaced with the imported measurements (blank/omitted raw
values become null), with `source=csv_import` and audit entries. Other weeks are preserved.

## Validation, transactions and reports

Every accepted upload creates an ImportJob. POST returns 201 for the created report, including
validation failure: inspect `status`, `rows_total`, `rows_succeeded`, `rows_failed`, and `errors`.
Each error has `row_number`, `field`, `code`, and a safe message; no source cell values are echoed.
Row numbers count CSV records: header 1, first data record 2; 0 denotes a file-level error.

- `validated`: `dry_run=true`, no academic/account data imported. Re-upload to commit.
- `validation_failed`: one or more problems; **zero** academic/account rows imported.
- `succeeded`: all rows imported atomically.
- `failed`: database conflict during execution; all data changes rolled back, report retained.

`rows_failed` counts distinct data rows with validation errors. Valid rows in a failed file are
not committed either; `rows_succeeded` remains zero. A file-level conflict has row number 0.
Malformed/empty files receive reports; oversized uploads return 413 before creating a job.
Unexpected infrastructure errors roll back the transaction and use the standard API error shape.
No uploaded CSV or plaintext password is persisted in the job. Import audits store counts/status.

Read reports with:

- `GET /api/v1/admin/imports/{job_id}`
- `GET /api/v1/admin/imports?limit=100&offset=0`

Other schools receive 404 for a job ID. Teacher/student roles receive 403. Processing is
synchronous and bounded; no external worker, email provider, or object storage is required.
