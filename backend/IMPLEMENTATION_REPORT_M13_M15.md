# EduGuard Milestones 13–15

## Implemented scope

- **M13:** teacher class risk summary with full-roster counts, support levels, trajectory,
  latest measured score/attendance, top saved signal, intervention flag and four sort modes.
- **M14:** self-only student dashboard, progress, visible interventions and goals. Added
  teacher student/course progress for reviewing measured changes after interventions.
- **M15:** admin student/weekly CSV imports, staged validation, preview mode, atomic execution,
  persistent job reports and paginated job history.

Existing authentication, authorization, pretrained inference and intervention workflows were
preserved. The pretrained joblib, notebook and original dataset were not modified or retrained.
The existing configurable CORS implementation was confirmed; it is not a missing component.

## Files changed

Paths are relative to `backend/`.

| Area | Files |
|---|---|
| New routes | `app/api/v1/dashboards.py`, `students.py`, `imports.py` |
| Route registration | `app/api/v1/router.py` |
| New services | `app/services/dashboard_service.py`, `progress_metrics.py`, `student_progress_service.py`, `import_service.py` |
| Weekly write reuse | `app/services/weekly_record_service.py` |
| New schemas | `app/schemas/dashboard.py`, `progress.py`, `import_job.py` |
| Raw completion field | `app/schemas/weekly_record.py`, `app/models/weekly_record.py`, `app/core/weekly_fields.py` |
| Import persistence | `app/models/import_job.py`, `app/models/__init__.py` |
| Migrations | `alembic/versions/0007_completion_raw_assignment_completion.py`, `0008_imports_csv_import_jobs.py` |
| Dependency | `pyproject.toml` adds `python-multipart` for multipart uploads |
| Tests | `tests/test_dashboard.py`, `test_student_dashboard.py`, `test_imports.py` |
| Live verification | `scripts/smoke_test.py` |
| Documentation/templates | `README.md`, `PROGRESS.md`, `IMPORTS.md`, this report, `examples/students.csv`, `examples/weekly_records.csv` |

## Endpoints

All paths use `/api/v1`.

| Method | Added path |
|---|---|
| GET | `/teacher/classes/{course_id}/risk-summary` |
| GET | `/teacher/students/{student_id}/progress` |
| GET | `/student/me/dashboard` |
| GET | `/student/me/progress` |
| GET | `/student/me/interventions` |
| GET | `/student/me/goals` |
| POST | `/admin/imports/students` |
| POST | `/admin/imports/weekly-records` |
| GET | `/admin/imports/{job_id}` |
| GET | `/admin/imports` |

Teacher summary sorts: attention, name, attendance, score. Counts are calculated before
pagination. Reads use bulk roster/history/prediction/intervention queries rather than SQL
queries per student. An unpredicted student is explicitly `not_assessed`. Academic summaries
and trends exclude future weeks; later-dated prediction snapshots cannot alter an earlier summary.

Student identity comes from authentication, never a requested student ID. Responses have explicit
field whitelists and omit probability, at-risk flags, risk labels, model explanations, severity,
prediction links, check-in text and private notes. Only the student's own visible interventions
and supported goal targets are returned. Student/dashboard reads do not run inference.

See [PROGRESS.md](PROGRESS.md) for trajectory thresholds, ordering, date/window semantics,
missing-value handling, intervention visibility and pagination.

## Database changes

- `0007_completion`: nullable raw `weekly_records.assignments_completed`, range validation,
  completed ≤ total, and late ≤ completed when both are known. Existing rows remain null.
  Completion is not fabricated from assignment count; the model's 40-feature contract is unchanged.
- **`0008_imports` (head):** ImportJob with UUID, tenant and uploader, filename/type/status,
  total/succeeded/failed counts, safe structured errors, timestamps, same-school uploader FK,
  count/status constraints and indexes for school/job-history access.

Weekly imports reuse the existing locked upsert and audit behavior with `source=csv_import`.
Student imports create Argon2-backed accounts and enroll them in the resolved class's active
courses. Validation finishes before academic/account writes begin. A nested transaction rolls
back all imported changes on a write conflict while retaining the failed-job report.

Imports are bounded to 1 MiB and 100 rows. Student import requires an academic year; weekly
import requires an explicit course. Ambiguous classes and duplicate identities/weeks are errors.
Generated initial passwords are returned only once to the initiating admin, never persisted in
job/audit reports. Upload content is not stored. See [IMPORTS.md](IMPORTS.md) for templates,
preview behavior, error row numbering, replacement semantics and credential handling.

## Verification

- M13 focused tests: **6 passed**.
- Dashboard/student/weekly regression group: **30 passed**.
- M15 focused tests: **15 passed**.
- Full existing and new suite: **124 passed, 1 warning in 958.09 seconds (15:58)**.
  The warning is the upstream Starlette/httpx TestClient deprecation; no failures or skips.
- `ruff check .`: **All checks passed**.
- `ruff format --check .`: **102 files already formatted**.
- Dependency check: **57 installed packages are compatible**.
- Development PostgreSQL: `alembic upgrade head` succeeded; `alembic current` reports
  **0008_imports (head)**; `alembic check` reports **No new upgrade operations detected**.
- Each test run migrates a fresh isolated PostgreSQL schema, then rolls back test data and
  removes only that schema. Application data is not reset; SQLite is not substituted.
- Live API: `/health`, `/ready`, `/docs`, `/openapi.json` returned **200**. Admin import-report,
  teacher summary/progress and student dashboard/progress/intervention/goal reads passed.
  All three demo roles passed login, refresh, logout and access-token revocation checks.
  The temporary verification server was stopped afterward; port 8000 is free for startup.
- Original notebook, dataset and model SHA-256 values match the previous verified versions.

Tests cover sorting, pagination versus whole-class counts, missing predictions/history, date
cutoffs, trend boundaries, role denial, tenant isolation, removed assignments, inactive/future
roster entries, student self-only access, hidden/other-student interventions, nested private-field
exclusion, optional completion, streaks, raw validation, import preview, login with generated
credentials, duplicate identities/classes/weeks, malformed CSV, UTF-8/BOM, upload limits,
cross-school course/student/job access, weekly replacement/history and atomic conflict rollback.

## Run and verify

From the repository root, using the existing configured PostgreSQL connection:

```powershell
cd backend
.venv312\Scripts\python -m alembic upgrade head
.venv312\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verified with Python 3.12.14 and the existing scikit-learn 1.6.1 pipeline. `python-multipart`
0.0.32 was installed for upload parsing. A fresh environment should install `.[dev]` from
`pyproject.toml`. Use the demo school/accounts documented in README; they were not reset.

Verification commands, from `backend/`:

```powershell
.venv312\Scripts\python -m pytest -q -p no:cacheprovider --tb=short
.venv312\Scripts\python -m ruff check .
.venv312\Scripts\python -m ruff format --check .
.venv312\Scripts\python -m alembic current
.venv312\Scripts\python -m alembic check
.venv312\Scripts\python scripts/smoke_test.py
```

Only pytest's optional filesystem cache was disabled. Tests and assertions are unchanged.
Docker is still absent, so the canonical Compose build/start/exec commands remain unverified;
the documented local commands exercised the real API and supplied PostgreSQL database.

## Remaining scope and limitations

- Milestones **16–20 were not implemented in this pass**. The check-in experiment and calendar
  are optional, v2 planning is blocked by the absent model-plan file, and further hardening and
  the complete 21-step acceptance test remain. This is not a claim that the whole backend is finished.
- The dict-bundle training path remains superseded by the instruction to use the existing
  pickled pipeline and sidecar metadata. No retraining was introduced.
- CORS configuration already exists, but it does not complete the rest of Milestone 19.
- Student progress currently covers active enrollments in active courses/classes. Metrics use
  an eight-week window; visibility and intervention status reflect current state, not a historical
  reconstruction. Missing current measurements and completion counts remain null.
- Import batches are synchronous, create students rather than update identities, and replace
  supplied weekly keys. A failed batch commits zero academic/account rows. External credential
  delivery, password-reset onboarding, and large background imports remain later work.
- Docker execution and real-school model calibration remain unverified. The model/data semantic
  limitations documented in the previous report and FEATURES.md still apply.
