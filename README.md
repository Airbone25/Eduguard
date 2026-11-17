# EduGuard

**Early-warning academic-risk platform for schools.** Teachers record weekly
observations, a scikit-learn model retrained in this repository turns a
student's longitudinal record into a risk probability, and the system converts
that signal into a trackable support plan — while keeping the underlying score
strictly private from students.

EduGuard is a full-stack reference implementation built to a written
specification. It ships a multi-tenant FastAPI backend and a React frontend,
and it is explicit about what the model can and cannot do.

---

## Table of contents

- [What the product does](#what-the-product-does)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [API surface](#api-surface)
- [Security and privacy model](#security-and-privacy-model)
- [Testing](#testing)
- [Database and migrations](#database-and-migrations)
- [The model](#the-model)
- [Project status](#project-status)
- [Known limitations](#known-limitations)
- [Further documentation](#further-documentation)

---

## What the product does

1. **A school administers its structure.** Classrooms, subjects, course
   offerings, teacher assignments and student enrollments, all scoped to one
   tenant.
2. **A teacher records raw weekly data** for their own students — classes held
   and attended, assessment averages, assignment counts, late submissions. No
   derived or ML features are ever accepted as input.
3. **The backend derives 40 temporal features** from that history using pure
   functions, and feeds them to a scikit-learn pipeline retrained by
   `backend/scripts/train_model.py` (the same feature builder that trains also
   serves). Missing values are filled only by the artifact's own fitted
   imputer.
4. **A prediction is persisted** together with the exact ordered feature
   snapshot, the model version, probability and mapped support level.
5. **The teacher gets an explanation and suggestions** derived only from that
   snapshot, and can turn a suggestion into a formal intervention.
6. **The intervention is tracked** with an immutable, sequenced timeline of
   follow-ups, status changes and completion.
7. **The student sees their own progress** — attendance, scores, streaks,
   improvements and any teacher action explicitly marked visible to them — and
   never a model score.

The single most important product rule: **the risk signal is a teacher-facing
aid, not a verdict shown to a child.**

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│  React 19 + Vite SPA    │  HTTPS  │  FastAPI  (/api/v1)                  │
│  TanStack Query + Zod   │ ──────► │                                      │
│  React Router + Zustand │  JSON   │  routes → services → SQLAlchemy 2    │
└─────────────────────────┘         │                    │                 │
                                    │                    ▼                 │
                                    │            PostgreSQL 16             │
                                    │      composite tenant FKs, CITEXT    │
                                    └──────────────────────────────────────┘
                                                          │
                                                          ▼
                                              ┌───────────────────────┐
                                              │  scikit-learn 1.6.1   │
                                              │  imputer → scaler →   │
                                              │  LogisticRegression   │
                                              └───────────────────────┘
```

**Layering.** Route files stay thin: they validate input with Pydantic,
resolve the current user through reusable dependencies, and delegate. Business
rules and authorization live in `services/`. Feature computation lives in `ml/`
and is deliberately free of database access, which makes it directly unit
testable and safe to reuse.

**Tenancy is structural, not conventional.** Every tenant-scoped table carries
`school_id` and uses composite foreign keys that include it. A cross-school
reference is therefore rejected by PostgreSQL itself, not merely by
application checks — the guarantee holds even for direct SQL writes. Tenant
identity is always taken from the authenticated user; any tenant ID in a
request body is rejected.

---

## Technology stack

**Backend**

| Concern | Choice |
|---|---|
| Language | Python 3.12 or 3.13 |
| Web framework | FastAPI, Uvicorn |
| Data validation | Pydantic 2 |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Database | PostgreSQL (CITEXT extension) |
| Auth | Argon2id password hashing, PyJWT access + refresh tokens |
| ML | scikit-learn 1.6.1 (pinned exactly), NumPy, pandas, joblib |
| Migrations/tests | pytest, httpx |
| Lint | Ruff |

**Frontend**

| Concern | Choice |
|---|---|
| Language | TypeScript 5.9 (strict) |
| Build | Vite 7 |
| UI | React 19 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Routing | React Router |
| Server state | TanStack Query |
| Local state | Zustand (UI only) |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Charts | Recharts |
| Icons | Lucide |
| Tests | Vitest, React Testing Library, MSW |
| Lint | ESLint (`--max-warnings 0`) |

---

## Repository layout

```
.
├── README.md                    this file
├── .gitignore                   excludes secrets, model binaries, datasets
├── .gitattributes               normalizes line endings (LF in the object DB)
│
├── 00_CODEX_START_HERE.md       execution entry points
├── 00_FRONTEND_CODEX_START_HERE.md
├── 01_BACKEND_ARCHITECTURE.md   tenancy, RBAC, data model, ML contract
├── 01_FRONTEND_ARCHITECTURE.md
├── 02_BACKEND_IMPLEMENTATION_PLAN.md    20 milestones + acceptance criteria
├── 02_FRONTEND_IMPLEMENTATION_PLAN.md
│
├── EduGuard_AI_Risk_Detection_Colab.ipynb
│                                 original notebook, kept for provenance reference
├── eduguard_risk_model.joblib   ⚠ UNTRACKED — retrain it (one command) or supply it
├── student_dataset_enriched.csv ⚠ UNTRACKED — supply it yourself
│
├── backend/
│   ├── app/
│   │   ├── api/v1/              thin route modules, one per feature area
│   │   ├── core/                settings, errors, security, permissions
│   │   ├── db/                  declarative base, session, demo seeds
│   │   ├── ml/                  feature definitions, builder, loader, inference
│   │   ├── models/              SQLAlchemy models (tenant-scoped)
│   │   ├── schemas/             Pydantic request/response contracts
│   │   ├── services/            business logic and authorization
│   │   └── main.py              app factory, middleware, lifespan
│   ├── alembic/versions/        9 linear migrations
│   ├── artifacts/               model_metadata.json tracked; .joblib not
│   ├── scripts/                 seed_demo, seed_frontend_demo, inspect_model,
│   │                            smoke_test
│   ├── tests/                   19 files, real PostgreSQL integration tests
│   ├── Dockerfile, docker-compose.yml
│   ├── pyproject.toml
│   ├── README.md                full API reference and operations guide
│   ├── FEATURES.md              the 40 feature formulas
│   ├── IMPORTS.md               CSV import contract
│   └── IMPLEMENTATION_REPORT*.md, PROGRESS.md
│
└── frontend/
    ├── src/
    │   ├── app/                  providers, router, query client, auth
    │   ├── components/           ui primitives, common, layout, charts
    │   ├── features/             auth, admin, classes, interventions,
    │   │                         predictions, progress, students,
    │   │                         weekly-records
    │   ├── lib/                  api client, pagination, labels, utils
    │   ├── pages/                Login, teacher/, admin/, student/
    │   ├── stores/               Zustand (UI state only)
    │   ├── test/                 MSW server, fixtures, 7 suites
    │   └── types/                API response contracts
    ├── eslint.config.js, vite.config.ts, tsconfig.json
    └── README.md, IMPLEMENTATION_REPORT.md
```

---

## Prerequisites

- **Python 3.12 or 3.13** — the pinned scikit-learn 1.6.1 artifact does not
  load under 3.14.
- **Node.js 20.19+** and npm (required by Vite 7; not yet declared as an
  `engines` constraint in `package.json`).
- **PostgreSQL 14+**, with permission for the target role to create schemas and
  install the `citext` extension.
- **The model artifact.** `eduguard_risk_model.joblib` is not committed, but it
  is reproducible: run the two training commands in [The model](#the-model).
  `student_dataset_enriched.csv` (for provenance checks only) is still
  supplied manually.

---

## Getting started

### 1. Backend

For this existing Windows checkout, start the backend with:

```powershell
& .\backend\start.ps1
```

The launcher selects `.venv312` explicitly, checks Python 3.12 and imports, and
starts the API. It works regardless of which environment your terminal has activated.
Use `-CheckOnly` to check imports without starting the server. If it reports a Python
version mismatch, follow [the environment repair instructions](backend/README.md#repair-a-python-version-mismatch-in-this-checkout).

For a **fresh Windows installation**, install Python 3.12, then:

```powershell
cd backend
py -3.12 -m venv .venv312
.\.venv312\Scripts\python.exe -m pip install -e ".[dev]"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit DATABASE_URL and JWT_SECRET for your installation.
```

Do not recreate an existing environment with unqualified `python -m venv`:
your global Python may be 3.14, and the folder name does not select Python 3.12.
On POSIX, use `python3.12 -m venv .venv312` and activate it with
`source .venv312/bin/activate` before installing dependencies.

The model artifact is reproducible rather than hand-supplied: from `backend/`,

```powershell
.\.venv312\Scripts\python.exe -m scripts.generate_synthetic_weekly
.\.venv312\Scripts\python.exe -m scripts.train_model --overwrite
```

The first script synthesizes longitudinal weekly records for 800 demo students
(1600 with `--students 1600`; 2–3 courses each, 14 weeks, five engagement
personas with noisy observations). The second computes the production `weekly-v1`
features from those raw rows, compares logistic regression, histogram gradient
boosting and random forest with GroupKFold split by student, derives thresholds
from out-of-fold probabilities, writes `backend/artifacts/eduguard_risk_model.joblib`
plus its repo-root mirror, and verifies the result with the production loader —
nothing needs to be copied manually.

Apply migrations, seed demo data, then start the API:

```powershell
.\.venv312\Scripts\python.exe -m alembic upgrade head
.\.venv312\Scripts\python.exe -m scripts.seed_demo
.\.venv312\Scripts\python.exe -m scripts.seed_frontend_demo
.\start.ps1
```

On POSIX, run the equivalent `python -m` commands from the activated Python 3.12
environment, then `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

Interactive API docs: <http://127.0.0.1:8000/docs>

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000/api/v1
npm run dev               # http://localhost:5173
```

The frontend defaults to `http://localhost:8000/api/v1` and the backend's
default CORS origin is `http://localhost:5173`, so the two work together with no
extra configuration.

### 3. With Docker

```bash
cd backend
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api pytest
docker compose exec api ruff check .
```

> **Status note.** Docker is not installed in the environment this project was
> verified in, so the compose path has never actually been executed. All
> verification below was performed with local Python against a live PostgreSQL
> instance. Treat the Dockerfile and compose file as written-but-unproven.

---

## Demo accounts

School slug: `demo` — password for all accounts: `EduGuard-Demo-2026!`

| Role | Email | Notes |
|---|---|---|
| School admin | `admin@demo.edu` | structure, users, imports, settings |
| Teacher | `teacher@demo.edu` | Maya Sharma |
| Student | `student@demo.edu` | Riya Patel, `S001` |
| Student | `student2@demo.edu` | Arjun Shah, `S002` |
| Student | `student3@demo.edu` | Neha Das, `S003` |

The first three come from `scripts/seed_demo.py`. All five, plus weekly history,
predictions and interventions so every dashboard has populated states, come from
`scripts/seed_frontend_demo.py`.

---

## API surface

60 operations across 11 route modules, all under `/api/v1`.

| Area | Base path | Purpose |
|---|---|---|
| Health | `/health`, `/ready` | liveness; readiness adds DB + model validation |
| Auth | `/auth/*` | login, refresh, logout, me, change-password |
| Admin | `/admin/*` | users, teachers, students, classes, subjects, course offerings, assignments, enrollments |
| Management | `/admin/settings`, listing endpoints | school settings and searchable lists |
| Teacher | `/teacher/*` | classes, roster, student detail, weekly records |
| Dashboards | `/teacher/classes/{id}/risk-summary` | class risk summary, sortable and paginated |
| Alert feed | `/teacher/alerts` | cross-course AI alert inbox: declining risk, unsupported at-risk students, new data, recoveries |
| Weekly records | `/teacher/students/{id}/weekly-records*` | single-week PUT, list, batch POST |
| Predictions | `/teacher/students/{id}/predictions`, `/teacher/classes/{id}/predictions` | run inference, list history |
| Explainability | prediction `contributions`, `/teacher/predictions/what-if` | per-feature attributions, counterfactual simulator |
| Interventions | `/teacher/.../interventions*` | create, list, read, update, timeline, complete |
| Student | `/student/me/*` | dashboard, progress, visible interventions, goals |
| Imports | `/admin/imports*` | CSV import for students and weekly records |
| Templates | `/admin/intervention-templates*` | school and global template management |

Full endpoint-by-endpoint detail is in [`backend/README.md`](backend/README.md).

---

## Security and privacy model

**Authentication**
- Argon2id password hashing; passwords are never logged or echoed.
- Access JWTs last 30 minutes; refresh JWTs have a 14-day absolute lifetime.
- Only SHA-256 digests of refresh tokens are stored. Refresh rotates the digest
  under a row lock, so an already-used token cannot be replayed, and rotation
  never extends the absolute session lifetime.
- Logout revokes the session. A password change revokes every session for that
  user. Deactivating a user revokes their sessions.
- Every authenticated request re-reads the active user, school and session from
  PostgreSQL. Role and school claims in a JWT cannot override database identity.

**Authorization**
- Tenant ownership always comes from the authenticated user, never the payload.
- Teachers reach a student only through an exact course assignment overlapping
  an active, already-started enrollment in an active course and classroom.
- Inaccessible resources return `404`; authenticated but wrong-role requests
  return `403`. Both are covered by tests.

**What a student can never see**
- `risk_probability`, `risk_level`, `at_risk`, internal severity values
- private teacher notes or internal timeline details

The student response schemas simply do not contain these fields, and
`tests/test_student_dashboard.py` seeds a prediction and a timeline note that
*do* contain them, then asserts none of those keys appear anywhere in any
student response at any nesting depth.

**Data handling**
- No PII, free text, student check-in text, risk labels or target columns ever
  reach model inference.
- Weekly edits never alter previously saved prediction snapshots.
- Request logs record request ID, user, school, route template, status and
  latency — never bodies, tokens, query strings or credentials.

---

## Testing

```bash
# Backend — 130 tests against a real PostgreSQL database
cd backend
python -m pytest -q
python -m ruff check .
python -m ruff format --check .

# Frontend — 47 tests
cd frontend
npm run test      # vitest
npm run lint      # eslint --max-warnings 0
npm run build     # tsc -b && vite build
```

**Backend tests use a real database.** Each run creates a uniquely named
`eduguard_test_<uuid>` schema, runs the full Alembic chain inside it, seeds it,
rolls back per test, and drops only that schema afterwards. SQLite is never
substituted and application tables are never truncated. Schema selection uses
`SET LOCAL` per transaction, so the suite stays isolated behind a transaction
pooler such as Neon or PgBouncer. The database role therefore needs permission
to create schemas and install `citext`.

**Frontend tests run against MSW** with `onUnhandledRequest: "error"`, so an
unstubbed request fails the test instead of quietly reaching the network.

---

## Database and migrations

Nine linear Alembic revisions:

| Revision | Contents |
|---|---|
| `0001_core` | school structure, users, profiles, classrooms, subjects, offerings, assignments, enrollments; installs CITEXT |
| `0002_auth` | refresh tokens and session revocation |
| `0003_audit` | administrative audit log |
| `0004_weekly` | weekly longitudinal records |
| `0005_inference` | model registry, feature snapshots, predictions, seven global intervention templates |
| `0006_interventions` | interventions and sequenced updates; unique key on predictions for tenant-safe linking |
| `0007_completion` | raw assignment completion counts |
| `0008_imports` | CSV import jobs |
| `0009_frequency` | intervention frequency attribute |

```bash
python -m alembic upgrade head      # apply
python -m alembic current            # which revision is applied
python -m alembic check              # ORM metadata vs database drift
```

`alembic check` reporting *No new upgrade operations detected* is the signal
that the models and the schema agree.

---

## The model

`backend/artifacts/eduguard_risk_model.joblib` is a serialized
**SimpleImputer (median) → StandardScaler → LogisticRegression** pipeline
trained with scikit-learn 1.6.1. The artifact embeds all 40 feature names,
their ordering, and the binary classes `[0, 1]`.
`artifacts/model_metadata.json` records the version, checksum, thresholds,
feature and adapter versions, preprocessing step names, out-of-fold metrics,
training date and provenance — and is the only model file tracked in git.

**The model is trained in this repository.** Milestone 8 is no longer a
substitute: `backend/scripts/generate_synthetic_weekly.py` synthesizes
longitudinal weekly records with known ground-truth labels, and
`backend/scripts/train_model.py` recomputes the production `weekly-v1` features
from those raw rows, compares logistic regression, histogram gradient boosting
and random forest with GroupKFold split by student, and ships the winner
(currently logistic regression: ROC-AUC 0.9999, PR-AUC 0.9998, Brier 0.0038 on
out-of-fold predictions). Thresholds are derived from the winner's
out-of-fold probabilities (`at_risk` = F2-optimal cut, watch/priority bands
anchored to it) instead of being copied from the old notebook. Because
features are computed by the same `app.ml.feature_builder` that serves the API,
training and inference can never drift apart.

The loader refuses to start on any of: checksum mismatch, scikit-learn version
drift, an unfitted pipeline, wrong feature count or ordering, out-of-range
thresholds, or degenerate probabilities. On failure, `/health` and `/docs` stay
available but `/ready` and every prediction request return `MODEL_UNAVAILABLE`,
so a broken model can never silently produce scores.

Verify notebook, header and artifact agreement without executing notebook cells:

```bash
python scripts/inspect_model.py
```

> ### Why the model and dataset are not in this repository
>
> `eduguard_risk_model.joblib` is excluded from version control
> (`*.joblib`, `artifacts/*`) but reproducible with the two training commands
> above; `model_metadata.json` — with its checksum, metrics and thresholds —
> is tracked so every commit pins exactly which model was verified.
> `student_dataset_enriched.csv` (used only for provenance checks against the
> original notebook) is still supplied manually. The notebook
> (`EduGuard_AI_Risk_Detection_Colab.ipynb`) *is* tracked for reference.

---

## Project status

Backend milestones complete: **1–7, 9–15**. Milestone 8 is now implemented as a
synthetic-data generator plus a real retraining pipeline.

| MS | Scope | State |
|---|---|---|
| 1–3 | Bootstrap, data model, auth/RBAC | ✅ |
| 4–5 | Admin APIs, teacher access model | ✅ |
| 6–7 | Weekly records, feature engineering | ✅ |
| 8 | Notebook → training script | ✅ synthetic generator + retraining pipeline (`scripts/train_model.py`) |
| 9–11 | Model registry/inference, explanations, recommendations | ✅ |
| 12 | Intervention tracking | ✅ |
| 13 | Teacher dashboard aggregation | ✅ |
| 14 | Student progress API | ✅ |
| 15 | CSV import | ✅ |
| 16 | Check-in / sentiment experiment | ⚠ text is captured and validated; no classifier |
| 17 | v2 stacked ensemble | ❌ blocked, model plan document absent |
| 18 | Google Calendar integration | ❌ not started |
| 19 | Hardening | ⚠ partial, see below |
| 20 | Final acceptance test | ❌ not written |

Frontend milestones complete: **1–16** and **19**. Milestones 17 (accessibility)
and 18 (responsive pass) are substantially implemented — `aria-label`, `role`,
visually-hidden text and labelled inputs are used throughout, and
`styles.css` carries seven media queries covering 1600/1280/1024/767/600 px plus
a `prefers-reduced-motion` block — but neither has been through a formal audit.
The known gap is that loading and error states announce through `role="status"`
rather than a dedicated `aria-live` region.

---

## Known limitations

Stated plainly, because a risk platform that overstates itself is worse than
one that admits its edges.

**ML validity**
- The shipped model is trained on synthetic longitudinal data whose ground-truth
  labels come from the same generator as the observations. Out-of-fold metrics
  (ROC-AUC 0.9999) therefore bound the pipeline, not real-school performance.
  The training corpus deliberately shares one feature builder with serving so
  no train/serve skew is possible, but calibration and predictive validity on
  real student data are **unproven** until the script is re-run on exported,
  consented school records.
- Weekly per-course averages and dispersion are documented *operational*
  mappings. Weekly score dispersion is not the same thing as cross-subject or
  individual-assessment dispersion.
- Other-subject marks and sentiment remain missing rather than being inferred
  from another teacher's restricted courses.
- Nothing here is a diagnosis. The system flags a trajectory for a human to
  look at.

**Data modelling**
- Weekly aggregates are keyed on `week_start`. They cannot reconstruct
  intra-week event timing or the state of a record before it was edited.
  Persisted prediction snapshots preserve the actual inputs used at the time.

**Security hardening still to do (M19)**
- No rate limiting on the login endpoint.
- No password-reset flow.
- No secrets-management or backup story for production.
- No audit-review tooling.
- `GET /admin/intervention-templates` is not paginated.

**Verification gaps**
- The Docker path has never been executed.
- The 21-step end-to-end acceptance test (Milestone 20) is not written. The plan
  states the backend is not finished until it passes.
- Frontend tests run against 12 MSW handlers, not against the live backend, so
  contract drift between the two would not be caught by CI.
- One non-blocking deprecation warning is emitted by the backend suite from
  Starlette's test client.

---

## Further documentation

| Document | Contents |
|---|---|
| [`01_BACKEND_ARCHITECTURE.md`](01_BACKEND_ARCHITECTURE.md) | tenancy model, RBAC matrix, data model, ML contract |
| [`01_FRONTEND_ARCHITECTURE.md`](01_FRONTEND_ARCHITECTURE.md) | layout, role boundaries, UI rules |
| [`02_BACKEND_IMPLEMENTATION_PLAN.md`](02_BACKEND_IMPLEMENTATION_PLAN.md) | 20 backend milestones with acceptance criteria |
| [`02_FRONTEND_IMPLEMENTATION_PLAN.md`](02_FRONTEND_IMPLEMENTATION_PLAN.md) | 20 frontend milestones with acceptance criteria |
| [`backend/README.md`](backend/README.md) | complete API reference, operations, troubleshooting |
| [`backend/FEATURES.md`](backend/FEATURES.md) | the 40 model features and minimum history |
| [`backend/IMPORTS.md`](backend/IMPORTS.md) | CSV import contract |
| [`backend/PROGRESS.md`](backend/PROGRESS.md) | milestone tracker |
| [`frontend/README.md`](frontend/README.md) | routes, architecture, run instructions |
| `IMPLEMENTATION_REPORT*.md` | milestone-by-milestone implementation and verification records |

---

## License and attribution

Internal academic project. The model artifact is retrained by
`backend/scripts/train_model.py` on synthetic data generated in this repository;
the dataset is not redistributed.
