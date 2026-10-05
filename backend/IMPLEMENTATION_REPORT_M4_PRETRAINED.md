# EduGuard: school management, pretrained model integration and interventions

## Scope

Completed Milestones **4–7** (admin management, teacher access, weekly history, feature
engineering), **9–11** (model registry/inference, explanations, recommendations) and **12**
(intervention tracking). Milestone 8's training task was replaced by inspection/integration of
the existing artifact, as requested. Existing Milestones 1–3 were retained.
**No model was trained or recreated.**

## Files

All paths below are relative to `backend/`.

| Area | Created/updated files |
|---|---|
| Routes | `app/api/v1/admin.py`, `teachers.py`, `weekly_records.py`, `predictions.py`, `templates.py`, `interventions.py`, `router.py`, `health.py` |
| Services | `app/services/common.py`, `school_service.py`, `teacher_service.py`, `weekly_record_service.py`, `feature_service.py`, `prediction_service.py`, `explanation_service.py`, `recommendation_service.py`, `template_service.py`, `intervention_service.py` |
| ML | `app/ml/__init__.py`, `feature_definitions.py`, `feature_builder.py`, `model_loader.py`, `inference.py` |
| Models | `app/models/audit_log.py`, `weekly_record.py`, `prediction.py`, `intervention.py`, `school.py`, `__init__.py` |
| Schemas | `app/schemas/school.py`, `weekly_record.py`, `prediction.py`, `recommendation.py`, `intervention.py` |
| Runtime | `app/core/weekly_fields.py`, `enums.py`, `permissions.py`, `config.py`, `app/main.py`, `app/db/session.py`, `alembic/env.py` |
| Migrations | `alembic/versions/0003_audit_school_management_audit.py`, `0004_weekly_weekly_longitudinal_records.py`, `0005_inference_pretrained_predictions_and_recommendations.py`, `0006_interventions_intervention_tracking.py` |
| Model assets | `artifacts/eduguard_risk_model.joblib` (unchanged copy), `artifacts/model_metadata.json` |
| Verification | `scripts/inspect_model.py`, `tests/conftest.py`, `test_admin.py`, `test_teachers.py`, `test_weekly_records.py`, `test_features.py`, `test_inference.py`, `test_predictions.py`, `test_recommendations.py`, `test_interventions.py` |
| Configuration/docs | `pyproject.toml`, `.env.example`, `.gitignore`, `.dockerignore`, `docker-compose.yml`, `README.md`, `FEATURES.md`, implementation reports |

Original notebook, dataset, root model and specifications were preserved. The requested
`eduguard-ai-v2-model-plan.md` was not found. Ignored `.venv312`/`.python`/`.uv-cache` hold the
Python 3.12 runtime; `.env` retains the supplied PostgreSQL connection without exposing it.

## Architecture and database

Thin FastAPI/Pydantic routes delegate to services; SQLAlchemy 2/PostgreSQL transactions
commit related records atomically. JWT/refresh/Argon2, UUIDs, revocation and role checks remain.
School-owned queries are tenant-scoped and composite foreign keys enforce school consistency.
Teachers require the exact assigned course and active, already-started student enrollment.
Disabled users/courses/classrooms cannot grant access. Unknown/inaccessible resources return
404; wrong roles return 403. Schema selection uses `SET LOCAL` per transaction for Neon pooling.

New models: **AuditLog, WeeklyRecord, ModelVersion, FeatureSnapshot, RiskPrediction,
InterventionTemplate, Intervention, InterventionUpdate**. Weekly records are unique per
student/course/Monday date; editing one week preserves other weeks and saved prediction
snapshots. Raw inputs and batch writes are validated, transactional and audited. Derived
features/tenant IDs cannot be supplied by teachers.

Migration chain:
`0001_core → 0002_auth → 0003_audit → 0004_weekly → 0005_inference → 0006_interventions`.
`0005_inference` seeds seven global intervention templates. Model version registration
occurs with the first successful prediction; unknown training metrics/date remain unspecified.
`0006_interventions` adds the two workflow tables, a unique `(school_id, id, student_id,
course_offering_id)` key on `risk_predictions` that the composite tenant foreign key requires,
and a unique `(intervention_id, sequence)` key on the update timeline.

## Added endpoints

Prefix: `/api/v1`. Teacher `classes/{course_id}` paths use course offering IDs.

| Method | Path |
|---|---|
| GET | `/admin/users` |
| POST | `/admin/teachers`, `/admin/students` |
| PATCH | `/admin/users/{user_id}` |
| GET, POST | `/admin/classes`, `/admin/subjects`, `/admin/course-offerings` |
| POST | `/admin/course-offerings/{course_id}/teachers`, `/admin/course-offerings/{course_id}/students` |
| GET | `/teacher/classes`, `/teacher/classes/{course_id}/students`, `/teacher/students/{student_id}` |
| PUT | `/teacher/students/{student_id}/weekly-records/{week_start}` |
| GET | `/teacher/students/{student_id}/weekly-records` |
| POST | `/teacher/weekly-records/batch` |
| POST, GET | `/teacher/students/{student_id}/predictions` |
| POST | `/teacher/classes/{course_id}/predictions` |
| GET, POST | `/admin/intervention-templates` |
| PATCH | `/admin/intervention-templates/{template_id}` |
| POST | `/teacher/students/{student_id}/interventions` |
| GET | `/teacher/students/{student_id}/interventions` |
| GET | `/teacher/interventions/{intervention_id}` |
| PATCH | `/teacher/interventions/{intervention_id}` |
| GET, POST | `/teacher/interventions/{intervention_id}/updates` |
| POST | `/teacher/interventions/{intervention_id}/complete` |

Student history/prediction routes require `course_offering_id`; POST predictions also take
`as_of_date`. Class prediction accepts `as_of_date`, runs synchronously for up to 100 students,
and rolls back the batch if any student lacks usable history. Existing auth/health/docs remain.

Intervention creation requires the exact course assignment plus an active enrollment for that
student in that course. `template_id` must be available to the school; `prediction_id`, when
given, must match the same school, student and course. Both are optional. Status moves
`planned → active → completed` or `planned/active → cancelled`; `completed` and `cancelled` are
terminal, and only `.../complete` may set `completed`. Student and course are immutable after
creation; goal targets allow only `assessment_avg_score_target`/`attendance_target` in 0–100.
Every write appends a timeline row (`created`, `note`, `status_change`, `completed`) with a
monotonic `sequence`, because rows written in one transaction share `now()`. Listing is
restricted to the requesting teacher's assigned courses. Students have no intervention routes
until Milestone 14.

## Features and model

Implemented attendance percentage, current assessment average, population standard deviation,
three-week averages, changes from exactly four weeks earlier, volatility, elapsed-week OLS
slopes, late-submission/low-score streaks, on-time submissions, last-minute submission rate,
participation rate, quiz volatility, engagement and academic consistency. Windows use at most
eight calendar weeks through `as_of_date`; gaps/insufficient history stay null. Both SQL and
the pure builder exclude future weeks. See [FEATURES.md](FEATURES.md) for exact formulas.

The existing joblib contains a complete fitted **SimpleImputer (median) → StandardScaler →
LogisticRegression Pipeline**, serialized with **scikit-learn 1.6.1**. It embeds **40 feature
names and their order**, classes `[0, 1]`, and supports `predict_proba`. Names/order match the
notebook's `EXCLUDE` logic applied to the CSV header. No notebook code was executed.

Custom version/threshold metadata was absent. The sidecar supplies `current-joblib-v1`,
`weekly-v1`, `pretrained-adapter-v1`, checksum and notebook thresholds (0.40/0.65, at-risk 0.50).
Artifact SHA-256: `36e3841c41a3f74311f380cc72d7386dfbbf124d276b4a8e1a9277dd6e52feb5`.
Startup validates checksum, runtime version, fitted state, feature count/order, thresholds and
finite probabilities. `/ready` fails with 503 `MODEL_UNAVAILABLE` on loader/validation failure.

Raw history → automatic features → exact training order → fitted pipeline → probability/support
mapping → measured signals → ranked templates → atomic persistence. Every prediction records
student/course/school, timestamp, model version, exact ordered feature snapshot including nulls,
probability, risk/support mapping, explanations and recommendations. Missing values use only the
artifact's existing fitted imputer during inference. No PII, free text, target or risk labels enter
inference. School-local templates can override defaults; recommendations do not create interventions.

## Demo accounts

School slug `demo`; development password `EduGuard-Demo-2026!` for `admin@demo.edu`,
`teacher@demo.edu`, `student@demo.edu`. Existing seed data/accounts were retained. The seed
provides classroom, subjects, Mathematics course, assignment and enrollment; no weekly history
is invented for the demo student. New default recommendation templates come from migration, and
the seed does not create interventions — teachers create them through the API.

## Verification results

- Final full suite: **95 passed, 1 warning in 707.75s** (`.venv312\Scripts\python -m pytest -q`).
- Intervention suite alone: **9 passed**; earlier Milestone 1–7 suite: **65 passed**; initial
  ML/recommendation tests: **20 passed**.
- `ruff check .`: **All checks passed**; `ruff format --check .`: **84 files already formatted**.
- Development PostgreSQL upgrade/current: **`0006_interventions (head)`**; `alembic check` reports
  **No new upgrade operations detected**. `0006_interventions` was additionally verified with a
  `downgrade 0005_inference` → `upgrade head` round trip, and reverted to head afterwards. Tests
  migrate a fresh isolated schema with all revisions, roll back per test, and clean up only their
  schema; no SQLite or application reset.
- Live Uvicorn: `/health`, `/ready`, `/docs`, `/openapi.json` **200**. Login, current user,
  refresh, logout and token revocation passed for all three roles.
- Live intervention cycle against the running server: create **201**, follow-up note **201**,
  complete **200**, repeated complete **409 `ALREADY_COMPLETED`**, ordered timeline
  `(1 created, 2 note, 3 completed)`, student-role create/read **403 `ROLE_FORBIDDEN`**. The
  temporary rows were deleted afterwards, returning the development database to its seeded state.
- Original notebook/dataset hashes match the first pass; root and copied model bytes match.
  `scripts/inspect_model.py` confirms notebook/header/model agreement.

New coverage includes cross-school access, wrong roles, exact-course access, revoked/unassigned
teachers, inactive/future enrollments, derived-feature/tenant injection, template isolation,
user deactivation, exact feature math, gaps/zero denominators, future exclusion, model contracts,
input ordering, missing-value processing, probability thresholds, readiness failure, registry
mismatch rollback, persisted version/snapshot and raw weekly API → persisted prediction. The
intervention tests add cross-school isolation, unassigned/inactive-enrollment denial, status
transition enforcement including 409 on repeat completion, review-date validation, goal whitelist
rejection, immutable student/course fields, and ordered timeline entries.

## Commands and startup

Verified runtime: Windows, **Python 3.12.14**, scikit-learn **1.6.1**, supplied PostgreSQL.
Docker is not installed, so equivalent local commands were used from `backend/`:

```powershell
.venv312\Scripts\python -m alembic upgrade head
.venv312\Scripts\python -m alembic current
.venv312\Scripts\python -m alembic check
.venv312\Scripts\python -m pytest -q --tb=short
.venv312\Scripts\python -m ruff check .
.venv312\Scripts\python -m ruff format --check .
.venv312\Scripts\python scripts/inspect_model.py
.venv312\Scripts\python scripts/smoke_test.py
```

The pytest filesystem cache works normally; it and `.ruff_cache` are gitignored and were removed
after the run. The original Python 3.14 environment was retained; the pinned model runtime uses
`.venv312`. Start from the repository root:

```powershell
cd backend
.venv312\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The verification server was stopped after the live checks, so port 8000 is free. Do not start a
second process on the same port. Docker startup/testing commands are in [README.md](README.md).

## Unresolved / deferred

- Docker image build/start remains unverified; local API/PostgreSQL execution was verified.
- The v2 plan file is absent, so v2 ensemble/training work is still undefined.
- Milestones **13+** are outside this pass: recommendation-outcome tracking, student dashboards
  and progress views, CSV import, teacher admin UI, and the remaining milestones.
- Dict-format model-bundle support in `app/ml/model_loader.py` was deliberately deferred until a
  retrained model is supplied; the current artifact is a single pickled pipeline.
- One non-blocking warning is emitted by the test suite: Starlette's `TestClient` reports that the
  installed `httpx` version is deprecated in favour of `httpx2`. It does not affect results.
- The notebook consumes precomputed synthetic features without defining every generating
  formula. Per-course weekly definitions are documented operational mappings; weekly score
  dispersion differs from cross-subject/individual-assessment dispersion. Other-subject marks
  and sentiment remain missing. Real-school calibration/accuracy has not been validated.
- Weekly cutoff uses `week_start`; aggregates cannot reconstruct intraweek events or pre-edit
  record versions. Persisted prediction snapshots preserve the actual inputs used.
