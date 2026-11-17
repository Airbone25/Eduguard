# EduGuard backend — school management and ML inference

FastAPI, PostgreSQL, SQLAlchemy 2, Alembic, Pydantic 2, Argon2id and JWT authentication.
Python 3.12 or 3.13 is required; this checkout was verified with Python 3.12.14.
Milestones 1–7, inference, explanations, recommendations and intervention
tracking, teacher dashboards, student progress/privacy, and CSV imports (through Milestone 15)
are implemented. See [PROGRESS.md](PROGRESS.md) and [IMPORTS.md](IMPORTS.md) for new API contracts.
Milestone 8's training task is now real: `scripts/generate_synthetic_weekly.py` +
`scripts/train_model.py` generate longitudinal data and retrain the risk model end to end
(see "Model contract" below).
`/ready` checks PostgreSQL and successful model loading/validation.

## Start with Docker

From the repository root:

```powershell
cd backend
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api python scripts/seed_demo.py
docker compose exec api pytest
docker compose exec api ruff check .
docker compose exec api python scripts/smoke_test.py
```

Open http://localhost:8000/docs. Compose uses its own local PostgreSQL service, regardless
of `DATABASE_URL` in `.env`; this keeps the Docker development stack self-contained. The
database persists in a named volume. Migrations and demo seeding are explicit commands.
The API and PostgreSQL ports bind to localhost. Development defaults work without `.env`.
For customized configuration, copy `.env.example` to `.env` only if `.env` does not exist.
Never commit `.env` or use the example passwords/JWT secret in production.

## Start with an existing PostgreSQL database (Windows)

Create `.env` from `.env.example` and set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL
beginning with `postgresql+psycopg://`. Preserve provider SSL query parameters.
The local ignored `.env` may already contain your supplied database connection.

```powershell
cd backend
py -3.12 -m venv .venv312
.venv312\Scripts\python -m pip install -e ".[dev]"
.venv312\Scripts\python -m alembic upgrade head
.venv312\Scripts\python -m scripts.seed_demo
.\start.ps1
```

This checkout already contains a verified `.venv312` environment. To start it from the
repository root:

```powershell
cd backend
.\start.ps1
```

The launcher uses `.venv312` explicitly and refuses to start if its interpreter is
not Python 3.12. Activation is unnecessary. `start.ps1 -CheckOnly` checks the
interpreter and application imports without launching a server; model and database
readiness are checked by `/ready` after startup. Use `-Port 8001` for another port.
The original Python 3.14 `.venv` cannot run the pinned scikit-learn 1.6.1 artifact.

### Repair a Python version mismatch in this checkout

The environment folder name does not select the Python version. Running
`python -m venv .venv312` with global Python 3.14 can replace its interpreter while
leaving Python 3.12 binary packages in place. This causes errors such as
`No module named 'pydantic_core._pydantic_core'`.

For this checkout's existing Python 3.12 packages, restore the bundled interpreter
without clearing or reinstalling those packages (run from `backend/`):

```powershell
& .\.python\cpython-3.12.14-windows-x86_64-none\python.exe -m venv --without-pip .venv312
& .\.venv312\Scripts\python.exe --version
& .\.venv312\Scripts\python.exe -m pip check
& .\.venv312\Scripts\Activate.ps1
```

The version must read `Python 3.12.14`. This repair applies to the mixed environment
described above; for a new checkout, create a fresh environment with a supported
Python version using the installation instructions above. Do not recreate it with
an unqualified `python` pointing to Python 3.14.

In a second terminal, from `backend/`:

```powershell
.venv312\Scripts\python -m pytest
.venv312\Scripts\python -m ruff check .
.venv312\Scripts\python -m scripts.smoke_test
```

## Demo data

School slug: `demo`; school name: **Demo Public School**.

| Email | Role | Development password |
|---|---|---|
| admin@demo.edu | school_admin | EduGuard-Demo-2026! |
| teacher@demo.edu | teacher | EduGuard-Demo-2026! |
| student@demo.edu | student | EduGuard-Demo-2026! |

The seed also creates Grade 10-A, Mathematics/Physics/Chemistry subjects, a 2026 Mathematics
course, its teacher assignment and student enrollment. All creation runs in one transaction.
Running the script again leaves the existing demo school unchanged, including passwords.
The CLI refuses to seed outside `ENVIRONMENT=development`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process health |
| GET | `/ready` | PostgreSQL and validated model readiness; 503 when unavailable |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc UI |
| GET | `/openapi.json` | OpenAPI schema |
| POST | `/api/v1/auth/login` | School slug + email + password |
| POST | `/api/v1/auth/refresh` | Rotate a refresh token |
| POST | `/api/v1/auth/logout` | Revoke the login session |
| GET | `/api/v1/auth/me` | Current user's safe profile |
| POST | `/api/v1/auth/change-password` | Change password and revoke all sessions |

Login body:

```json
{"school_slug":"demo","email":"teacher@demo.edu","password":"EduGuard-Demo-2026!"}
```

The response contains `access_token`, `refresh_token`, `token_type` and a safe `user` schema.
Use Swagger's login **Try it out**, then paste `access_token` into **Authorize**. Protected
requests send `Authorization: Bearer <access_token>`. Refresh/logout bodies are
`{"refresh_token":"..."}`. Password changes require a bearer token and
`{"current_password":"...","new_password":"..."}`; the new password must be 12–128
characters. Login email is case-insensitive within a school; school slug disambiguates
the same email in different schools. Auth input rejects extra fields such as `role` or `school_id`.

### School management, weekly records and predictions

All paths below begin with `/api/v1`. Class IDs in teacher URLs refer to **course offering**
IDs, connecting classroom, subject and academic year. Use IDs returned by creation/list APIs.

| Method | Path |
|---|---|
| GET | `/admin/users` |
| POST | `/admin/teachers`, `/admin/students` |
| PATCH | `/admin/users/{user_id}` |
| GET, POST | `/admin/classes`, `/admin/subjects`, `/admin/course-offerings` |
| POST | `/admin/course-offerings/{course_id}/teachers` |
| POST | `/admin/course-offerings/{course_id}/students` |
| GET | `/teacher/classes` |
| GET | `/teacher/classes/{course_id}/students` |
| GET | `/teacher/students/{student_id}` |
| PUT | `/teacher/students/{student_id}/weekly-records/{week_start}` |
| GET | `/teacher/students/{student_id}/weekly-records?course_offering_id=...` |
| POST | `/teacher/weekly-records/batch` |
| POST | `/teacher/students/{student_id}/predictions` |
| GET | `/teacher/students/{student_id}/predictions?course_offering_id=...` |
| POST | `/teacher/classes/{course_id}/predictions` |
| POST | `/teacher/predictions/what-if` |
| POST | `/teacher/students/{student_id}/interventions` |
| GET | `/teacher/students/{student_id}/interventions?course_offering_id=&status=` |
| GET | `/teacher/interventions/{intervention_id}` |
| PATCH | `/teacher/interventions/{intervention_id}` |
| GET, POST | `/teacher/interventions/{intervention_id}/updates` |
| POST | `/teacher/interventions/{intervention_id}/complete` |
| GET, POST | `/admin/intervention-templates` |
| PATCH | `/admin/intervention-templates/{template_id}` |
| GET | `/teacher/classes/{course_id}/risk-summary` |
| GET | `/teacher/alerts?as_of_date=&limit=&offset=` |
| GET | `/teacher/students/{student_id}/progress?course_offering_id=...` |
| GET | `/student/me/dashboard`, `/student/me/progress` |
| GET | `/student/me/interventions`, `/student/me/goals` |
| GET | `/admin/imports`, `/admin/imports/{job_id}` |
| POST | `/admin/imports/students`, `/admin/imports/weekly-records` |

`GET /teacher/alerts` is the cross-course signal feed for the AI alert inbox. For each
(student, course) with at least one saved prediction, it derives exactly one alert kind:
`declining` when risk rose by ≥ 0.05 between the two most recent predictions,
`needs_support` when the latest prediction is at-risk with no open intervention,
`new_data` when weekly records exist beyond the last insight's `as_of_date`, and
`improving` when risk fell by ≥ 0.05. Quiet students are excluded. All set-based
(window function, grouped aggregates); every query is tenant-filtered to the
authenticated teacher's active courses, so revoked assignments vanish from the feed.

**Explainability.** Every prediction response carries `contributions` — the
per-feature attributions behind that probability. For the linear risk model the
attribution is exact (`coefficient × standardized value`), contributions plus
the intercept reproduce the log-odds exactly (asserted in tests), and names are
aligned to the columns the classifier actually sees after the imputer drops
never-observed inputs. Attributions are recomputed at read time from the stored
snapshot, so they always reflect the deployed model re-evaluating the exact
recorded inputs.

**What-if simulator.** `POST /teacher/predictions/what-if` with
`{"prediction_id": ..., "overrides": {"Attendance_Percent": 95, ...}}` re-scores
the stored snapshot with overridden values and returns baseline/new probability,
support level and delta. Overrides are limited to a whitelist of interpretable
features with safe ranges (`UNKNOWN_SIMULATION_FEATURE`,
`SIMULATION_VALUE_OUT_OF_RANGE` otherwise); nothing is persisted and no school
data changes. Course-level authorization applies (`404` for outsiders).

Weekly PUT example (Monday `week_start` in the URL):

```json
{
  "course_offering_id": "<course UUID>",
  "classes_held": 5,
  "classes_attended": 4,
  "assessment_avg_score": 65,
  "assessment_count": 2,
  "assignment_count": 3,
  "late_submissions": 1,
  "study_hours_weekly": 6
}
```

Each student/course/week has its own row. PUT replaces that week's raw measurements;
omitted optional fields become null. Other weeks and prior prediction snapshots remain
unchanged. Batch bodies contain `records`, each with `student_id`, `week_start`,
`course_offering_id` and raw measurements; at most 100 rows, committed atomically.
Derived features and caller-supplied tenant IDs are rejected.

Prediction body:

```json
{"course_offering_id":"<course UUID>","as_of_date":"2026-02-02"}
```

Class prediction accepts only `as_of_date`; it processes at most 100 enrolled students in
one transaction. No usable history returns 422; one such student rolls back the whole batch.
All teacher data and predictions require the exact course assignment and active enrollment.
Admin management endpoints require school-admin role; student accounts cannot read internal
prediction endpoints. List endpoints support bounded `limit` and `offset` pagination.

## Interventions

A prediction becomes a teacher-managed support workflow. Creating an intervention requires the
exact course assignment and an active enrollment for that student in that course:

```json
{
  "course_offering_id": "<course UUID>",
  "title": "Weekly Mathematics Review",
  "start_date": "2026-02-02",
  "review_date": "2026-02-16",
  "visibility_to_student": true,
  "goal_definition": {"assessment_avg_score_target": 70, "attendance_target": 90},
  "template_id": "<optional template UUID>",
  "prediction_id": "<optional prediction UUID>"
}
```

`template_id` must be a template available to the school (global default or school override).
`prediction_id`, when supplied, must belong to the same school, student and course. Both are
optional: a teacher can plan support without running a prediction first.

Status moves `planned → active → completed`, or `planned/active → cancelled`. `completed` and
`cancelled` are terminal. `PATCH` may change title, review date, goals, student visibility and
the open statuses; use `POST .../complete` to finish, which sets `completed_at`. Every write
appends an immutable timeline entry (`created`, `note`, `status_change`, `completed`) carrying a
monotonic `sequence`, because entries written in one transaction share a timestamp. The
intervention and its first entry are committed together, so a failure cannot leave a plan
without its history.

`student_id` and `course_offering_id` are immutable after creation, and goal targets accept only
`assessment_avg_score_target` and `attendance_target` in 0–100. Teachers see only interventions
for courses assigned to them; students have no intervention endpoints yet (Milestone 14).
Recommendations remain suggestions — nothing creates an intervention automatically.

## Model contract

`artifacts/eduguard_risk_model.joblib` is a fitted **SimpleImputer (median) → StandardScaler →
LogisticRegression** pipeline, retrained by `scripts/train_model.py` (scikit-learn 1.6.1) on
synthetic longitudinal weekly records. The artifact embeds all 40 feature names, their
ordering, and binary classes `[0, 1]`. `artifacts/model_metadata.json` supplies the version,
checksum, thresholds, feature/adapter versions, out-of-fold metrics, preprocessing step names,
training date and provenance — and is the only model file tracked in git.

Reproduce the full pipeline (generate data, then train, evaluate and self-verify):

```powershell
.venv312\Scripts\python -m scripts.generate_synthetic_weekly
.venv312\Scripts\python -m scripts.train_model --overwrite
```

Features are computed by the production `app.ml.feature_builder` from raw weekly rows —
never from a precomputed table — so training and serving share one code path. Model selection
compares logistic regression, histogram gradient boosting and random forest with 5-fold
GroupKFold split by student; thresholds are derived from out-of-fold probabilities
(`at_risk` = F2-optimal cut, `medium`/`high` anchored to it). The script writes both the
backend artifact and the repo-root mirror, backs up the previous artifact to
`outputs/previous_artifact.joblib`, and only replaces files when `--overwrite` is passed.

`MODEL_BUNDLE_PATH` and `MODEL_METADATA_PATH` resolve relative to `backend/` (or `/app` in
Docker). Startup validates checksum, runtime version, fitted state, feature names/count/order,
thresholds and usable probabilities with missing inputs. Failure leaves `/health` and `/docs`
available but returns `MODEL_UNAVAILABLE` from `/ready` and prediction requests.

The prediction service builds features from authorized weekly history through `as_of_date`,
explicitly orders them using the training contract, and runs the fitted pipeline. Thresholds
are read from metadata (`medium` / `high` / `at_risk`), so support levels track retraining:
`doing_well` below `medium`, `watch` from `medium` to below `high`, `priority_support` from
`high`, and `at_risk` is the binary cut. Model registry, exact ordered input snapshot,
prediction, measurable signals, suggested actions and audit entry are persisted atomically.
The registry keeps exactly one active version: retraining swaps it in cleanly, while a row
whose checksum no longer matches the loaded artifact still fails with `MODEL_VERSION_CONFLICT`
instead of being overwritten.
Templates are suggestions only; the system does not create interventions automatically.
Seven global templates are seeded by migration; school-specific templates can override them
by name, including disabling a default. Global templates cannot be edited by school admins.

See [FEATURES.md](FEATURES.md) for formulas and minimum history. Missing historical values
remain null in snapshots; only the model's fitted imputer fills model inputs.
Unobserved other-subject marks and sentiment stay missing. No PII, labels, free text,
`Risk_Score`, `Risk_Level`, or `At_Risk` enter inference.

**Data limitation:** weekly per-course averages and dispersion have explicit operational
definitions. The training corpus is synthetic (generated personas and noisy weekly
observations with known ground-truth labels), so reported out-of-fold metrics bound what the
pipeline can achieve, not real-school predictive validity. Real deployments retrain on
exported, consented school data with the same script. Cross-subject marks are
not inferred from another teacher's restricted courses. Weekly dates cannot reconstruct
intraweek event times or past versions of edited records; saved prediction snapshots are fixed.

Verify artifact/notebook/header agreement without executing notebook cells:

```powershell
.venv312\Scripts\python scripts/inspect_model.py
```

Compose mounts the original notebook, CSV and joblib read-only under `/reference` so this
provenance check also runs in container tests. They are not read by the prediction service.

## Architecture and security

- `app/api/`: thin routes and reusable current-user/role/teacher-resource dependencies.
- `app/services/`: auth, school management, teacher access, weekly records, features,
  predictions, explanations, recommendations, template management, interventions, alerts,
  dashboards, measured student progress and transactional CSV imports.
- `app/ml/`: pure weekly feature calculations, validated model loader and ordered inference.
- `app/core/`: settings, errors, Argon2/JWT helpers, assignment and tenant authorization.
- `app/models/`: School, User, TeacherProfile, StudentProfile, Classroom, Subject,
  CourseOffering, CourseTeacher, Enrollment, RefreshToken, AuditLog, WeeklyRecord,
  ModelVersion, FeatureSnapshot, RiskPrediction, InterventionTemplate, Intervention and
  InterventionUpdate and ImportJob.
- `app/db/`: declarative base, session lifecycle and transactional demo seed.
- `alembic/versions/`: `0001_core`, `0002_auth`, `0003_audit`, `0004_weekly`,
  `0005_inference`, `0006_interventions`, `0007_completion`, `0008_imports` (current head).
- `tests/`: PostgreSQL integration tests, API tests and test-only routes exercising RBAC.

Entity IDs are UUIDs; CourseTeacher uses the specified composite course/teacher primary key.
Dates are ISO-8601; timestamps are PostgreSQL TIMESTAMPTZ. Composite foreign keys enforce
same-school relationships even for direct SQL writes. Case-insensitive user email uniqueness
is enforced with CITEXT. Required unique school slugs, roll numbers, subject codes and
enrollments are enforced by PostgreSQL. ORM navigation relationships for tenant links are
read-only; write explicit validated IDs. They do not replace authorization checks.

Access JWTs last 30 minutes by default. Refresh JWTs have a 14-day absolute session lifetime.
Only SHA-256 refresh-token digests are stored. Refresh rotates the digest under row locks,
so a used refresh token cannot be reused. Rotation does not extend the absolute lifetime.
Logout revokes that session, including its access tokens. Password changes revoke every
session. Every authenticated request checks the current active user, school and session in
PostgreSQL; JWT role and school claims cannot override database identity.

Tenant ownership comes from the authenticated user. Teachers need an assignment that
overlaps an active, already-started student enrollment in an active course/classroom.
Students can access only themselves; admins are restricted to their own school. Inaccessible
resources return 404 consistently; wrong roles return 403. Guards are tested through both
product APIs and focused authorization tests. Deactivating a user revokes their sessions.

Errors use `{"error":{"code":"...","message":"...","details":null}}` (validation errors
contain field/error-code details). Validation responses never echo input passwords. Application
request logs contain generated request IDs, user/school IDs when authenticated, route templates,
status and latency; they omit bodies, tokens, query strings and credentials.

## Database verification

Tests use the configured PostgreSQL database. The database role needs permission to create
schemas and install/use CITEXT. A test run creates a uniquely named `eduguard_test_<uuid>`
schema, runs real Alembic migrations there, seeds it, and removes only that schema afterwards.
Per-test transactions are rolled back. The suite does not truncate/reset application tables
and never substitutes SQLite. If interrupted, an isolated test schema may remain.
Schema selection uses `SET LOCAL` on each transaction, including application sessions, so
tests and requests remain isolated when using a transaction pooler such as Neon/PgBouncer.

`alembic check` verifies that ORM metadata agrees with the migrated application database.
The initial migration installs CITEXT in `public`; downgrade intentionally leaves the shared
extension installed. `0006_interventions` was additionally verified with a
`downgrade 0005_inference` → `upgrade head` round trip. See
`IMPLEMENTATION_REPORT_M4_PRETRAINED.md` for the earlier pass, and
`IMPLEMENTATION_REPORT_M13_M15.md` for current verification results and environment limitations.
