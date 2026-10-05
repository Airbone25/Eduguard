# Implementation report: Milestones 1–3

> Historical first-pass report. See [IMPLEMENTATION_REPORT_M4_PRETRAINED.md](IMPLEMENTATION_REPORT_M4_PRETRAINED.md)
> for the current implementation, model integration, runtime and verification results.
> Test counts, migration names and endpoint lists below describe that pass only and are
> superseded by the current report; they are kept for traceability, not as live documentation.

Implemented under `backend/`. Verified with the supplied PostgreSQL database and a running
local Uvicorn process. **Docker execution is still unverified because Docker is not installed.**
No milestone 4 product APIs, frontend, or ML inference were added.

## 1. Files created

All new implementation files are inside `backend/`; existing specification and project assets
were not edited.

| Area | Files |
|---|---|
| Runtime/configuration | `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `.env.example`, `.gitignore`, `.dockerignore` |
| Application | `app/main.py`, package `__init__.py` files |
| API | `app/api/deps.py`, `app/api/v1/router.py`, `app/api/v1/health.py`, `app/api/v1/auth.py` |
| Core | `app/core/config.py`, `enums.py`, `exceptions.py`, `permissions.py`, `security.py` |
| Database | `app/db/base.py`, `session.py`, `seed.py` |
| Models | `app/models/school.py`, `refresh_token.py`, model exports in `__init__.py` |
| Auth schemas/service | `app/schemas/auth.py`, `app/services/auth_service.py` |
| Migrations | `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, both revision files in `alembic/versions/` |
| Scripts | `scripts/seed_demo.py`, `scripts/smoke_test.py` |
| Tests | `tests/conftest.py`, `test_health.py`, `test_models.py`, `test_auth.py`, `test_permissions.py`, `test_sessions.py` |
| Documentation/assets | `README.md`, `IMPLEMENTATION_REPORT.md`, `artifacts/.gitkeep` |

Local ignored `.env` contains the supplied database URL. Local `.venv` holds installed
dependencies. Neither belongs in source control or the Docker build context.

Notebook SHA-256 remains `330F8E2B26591B6FC1E2363B121F9FB9D3C7FDD49B6D2BB720E9417A3C65BB7B`.
Dataset SHA-256 remains `A7CF6EDA377B2668D73437A33CA82D874F961DEFE5C850DDAC7005B2A51B352F`.
`eduguard-ai-v2-model-plan.md` was not present in this workspace. The supplied `.joblib`
artifact was not modified or loaded.

## 2. Architecture implemented

FastAPI with Pydantic v2 settings and explicit response schemas; SQLAlchemy 2 with PostgreSQL;
Alembic migrations; shared-table school tenancy; UUID identifiers; UTC-aware timestamps;
Argon2id password hashing; access/refresh JWTs; hashed refresh-token persistence, rotation and
revocation; database-backed active user/school/session validation; Admin/Teacher/Student RBAC;
same-school composite foreign keys; teacher assignment/enrollment authorization; consistent
errors; structured request logging; configurable CORS.

The schema is selected transaction-locally for compatibility with the supplied Neon pooler.
Row locks prevent two simultaneous refreshes from both succeeding. Logout revokes the login
session's access and refresh tokens; password changes revoke all sessions.

## 3. Endpoints implemented

- `GET /health`, `GET /ready`
- `GET /docs`, `GET /redoc`, `GET /openapi.json`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

RBAC and teacher-resource guards are exercised through test-only routes; school-management
and teacher product routes remain deferred as requested.

## 4. Database models

School, User, TeacherProfile, StudentProfile, Classroom, Subject, CourseOffering,
CourseTeacher, Enrollment, RefreshToken.

## 5. Alembic revisions

- `0001_core`: core school structure, constraints, indexes and CITEXT extension.
- **`0002_auth` (head)**: revocable authentication sessions.

Both applied successfully to the initially empty application database. Every integration test
run also applies both revisions to a fresh isolated schema. `alembic check` reports
**No new upgrade operations detected**.

## 6. Demo accounts

School: **Demo Public School**, slug **`demo`**. Password for all three development accounts:
**`EduGuard-Demo-2026!`**.

| Account | Role |
|---|---|
| `admin@demo.edu` | `school_admin` |
| `teacher@demo.edu` | `teacher` |
| `student@demo.edu` | `student` |

The seed also creates Grade 10-A, Mathematics/Physics/Chemistry, the Mathematics course,
teacher assignment and student enrollment. The script was run repeatedly and retained the
same demo school without duplicating or resetting accounts.

## 7. Test results

Actual environment: Windows, Python **3.14.4**, supplied PostgreSQL **18.6**.

- Full pytest suite: **34 passed** in 198.67 seconds.
- After strengthening the roll-number uniqueness assertion, all **7 model tests passed** again.
- One upstream Starlette/httpx TestClient deprecation warning; no test failures or skips.
- Database connectivity and clean-schema migrations passed.
- Login for all roles, bad credentials, inactive users/schools, token expiration/type/tampering,
  refresh rotation/reuse, logout, password changes and revocation passed.
- Wrong-role access, School A/School B isolation, unassigned teachers, inactive/future
  enrollments, inactive courses/classrooms, removed assignments and student self-only access passed.
- Separate database sessions across HTTP requests and concurrent refresh tests passed.
- Live Uvicorn HTTP smoke test: `/health`, `/ready`, `/docs`, `/openapi.json` all **200**.
  Login, `/me`, refresh, logout and access revocation passed for all three demo accounts.

Tests used real PostgreSQL and migrated isolated schemas, with transaction rollbacks per test.
The local pytest command disabled only the filesystem cache plugin because Windows sandbox
cache creation was denied; collection, assertions and integration coverage were unchanged.

## 8. Lint results

- `ruff check .`: **All checks passed**.
- `ruff format --check . --no-cache`: **38 files already formatted**.
- `pip check`: **No broken requirements found**.

## 9. Startup and commands

To start using the configured database and already-installed virtual environment, from the
repository root:

```powershell
cd backend
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The verification process was left running at http://127.0.0.1:8000; do not start a second
process on the same port while it is running. Swagger: http://127.0.0.1:8000/docs.

The Docker workflow, once Docker Desktop is available, is:

```powershell
cd backend
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api python scripts/seed_demo.py
docker compose exec api pytest
docker compose exec api ruff check .
```

Running from `backend/` is necessary because that directory contains the Compose file.
Compose provisions its own local PostgreSQL 17 database and uses Python 3.12.

`docker compose up --build -d` was attempted and failed because the `docker` command was
not found. Consequently, container execution could not be verified. The following equivalents
were successfully run from `backend/` against the supplied database:

```powershell
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m alembic current
.venv\Scripts\python -m alembic check
.venv\Scripts\python scripts/seed_demo.py
.venv\Scripts\python -m pytest -p no:cacheprovider
.venv\Scripts\python -m ruff check .
.venv\Scripts\python scripts/smoke_test.py
```

## 10. Incomplete / intentionally deferred

- **Docker build/start and container-based verification remain pending** on a Docker-enabled host.
  Local execution against PostgreSQL is verified; the container image itself is not.
- Missing v2 model-plan asset does not block milestones 1–3, but is needed for later ML work.
- Milestones 4 onward, frontend, inference, training, intervention workflows and later hardening
  remain intentionally unimplemented. No continuation to milestone 4 was attempted.
