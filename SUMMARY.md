# SUMMARY.md — EduGuard project summary

*Generated 2026-11-17 from a full repository analysis.*

---

## 1. What this project is

**EduGuard** is an early-warning academic-risk platform for schools, built as a
full-stack reference implementation to a written specification. Teachers record
raw weekly observations, a scikit-learn model turns a student's longitudinal
record into a risk probability, and the system converts that signal into a
trackable support plan.

The single most important product rule: **the risk signal is a teacher-facing
aid, not a verdict shown to a child.** Students see their own progress
(attendance, scores, streaks, visible teacher actions) but never a model score
— student response schemas simply do not contain risk fields, and a dedicated
test seeds hidden data and asserts it never leaks into any student response.

## 2. Architecture at a glance

```
React 19 + Vite SPA  ──HTTPS/JSON──►  FastAPI (/api/v1)
TanStack Query, Zod,                 routes → services → SQLAlchemy 2
React Router, Zustand                          │
                                               ▼
                                     PostgreSQL 16
                              composite tenant FKs, CITEXT
                                               │
                                               ▼
                                   scikit-learn 1.6.1
                          imputer → scaler → LogisticRegression
```

Key architectural decisions:

- **Structural multi-tenancy.** Every tenant-scoped table carries `school_id`
  inside composite foreign keys, so a cross-school reference is rejected by
  PostgreSQL itself — even for direct SQL writes. Tenant identity always comes
  from the authenticated user, never the request payload.
- **Thin routes, fat services.** Route modules only validate (Pydantic) and
  resolve the current user; business rules and authorization live in
  `services/`; feature computation lives in `ml/` with no database access, so
  it is pure-function unit-testable.
- **Train/serve identity.** The same `app.ml.feature_builder` computes
  features for training and serving, so drift between the two is impossible.

## 3. Technology stack

| Layer | Choices |
|---|---|
| Backend | Python 3.12/3.13, FastAPI, Pydantic 2, SQLAlchemy 2.0, Alembic, PostgreSQL (CITEXT), Argon2id + PyJWT (access/refresh), pytest, Ruff |
| ML | scikit-learn 1.6.1 (pinned exactly), NumPy, pandas, joblib |
| Frontend | TypeScript 5.9 (strict), Vite 7, React 19, Tailwind CSS 4 + shadcn/ui, React Router, TanStack Query + TanStack Table, Zustand (UI only), React Hook Form + Zod, Recharts, Lucide, Vitest + RTL + MSW, ESLint `--max-warnings 0` |

## 4. Repository layout and size

```
.
├── README.md / PLAN.md / SUMMARY.md
├── 00_*_START_HERE.md, 01_*_ARCHITECTURE.md, 02_*_IMPLEMENTATION_PLAN.md
├── EduGuard_AI_Risk_Detection_Colab.ipynb   original notebook (provenance)
├── eduguard_risk_model.joblib               ⚠ untracked, retrainable
├── student_dataset_enriched.csv             ⚠ untracked, supplied manually
├── backend/                                 73 app files (~5,100 LOC)
│   ├── app/ api/v1 · core · db · ml · models · schemas · services
│   ├── alembic/versions/                    9 linear migrations
│   ├── artifacts/                           model + metadata (tracked JSON)
│   ├── scripts/                             generate_synthetic_weekly,
│   │                                        train_model, seed_demo,
│   │                                        seed_frontend_demo, inspect_model,
│   │                                        smoke_test
│   ├── tests/                               21 files (~3,200 LOC), real PG
│   └── Dockerfile, docker-compose.yml, start.ps1
├── frontend/                                80 TS/TSX files (~8,500 LOC)
│   ├── src/app/         providers, router, query client, auth
│   ├── src/components/  ui · common · layout · charts
│   ├── src/features/    admin, alerts, auth, classes, interventions,
│   │                    predictions, progress, students, weekly-records
│   ├── src/pages/       Login; admin/, student/, teacher/ dashboards (14 pages)
│   ├── src/lib/         typed API client, pagination, labels
│   ├── src/test/        MSW server + fixtures, 9 test suites
│   └── src/types/       API response contracts
└── outputs/                                 ER diagrams (.mmd + MD), slide
                                             content, evaluation PPTX,
                                             training_report.json,
                                             synthetic_weekly.csv
```

## 5. Backend

### API surface

**62 endpoint operations across 12 route modules**, all under `/api/v1`:

| Module | Purpose |
|---|---|
| `health.py` | `/health` liveness; `/ready` adds DB + model validation |
| `auth.py` | login, refresh, logout, me, change-password |
| `admin.py` | users, teachers, students, classes, subjects, offerings, assignments, enrollments |
| `management.py` | school settings, searchable lists |
| `teachers.py` | classes, roster, student detail |
| `dashboards.py` | class risk summary; `/teacher/alerts` AI alert inbox (declining / needs_support / new_data / improving) |
| `weekly_records.py` | single-week PUT, list, batch POST |
| `predictions.py` | run inference, history, **what-if simulator** |
| `interventions.py` | create, track with immutable sequenced timeline, complete |
| `students.py` | student dashboard, progress, visible interventions, goals |
| `imports.py` | CSV import for students and weekly records |
| `templates.py` | school + global intervention templates |

### Security model

- Argon2id hashing; access JWTs 30 min; refresh JWTs 14-day absolute lifetime
  with SHA-256 digest storage and locked rotation (replay-safe).
- Every request re-reads user/school/session from PostgreSQL — JWT claims
  cannot override database identity.
- Teachers reach a student only through an exact course assignment overlapping
  an active enrollment; inaccessible resources return `404`, wrong role `403`.
- Students can never see risk scores, risk levels or private notes/timeline.
- Logs record request ID, user, school, route, status, latency — never bodies,
  tokens or query strings.

### Database

9 Alembic migrations: core structure → auth sessions → audit → weekly records
→ inference (model registry, snapshots, predictions, 7 global templates) →
interventions → completion counts → import jobs → intervention frequency.
`alembic check` reports no drift between ORM and schema.

## 6. The ML model

`backend/artifacts/eduguard_risk_model.joblib` — a
**SimpleImputer (median) → StandardScaler → LogisticRegression** pipeline,
**trained inside this repository**:

1. `scripts/generate_synthetic_weekly.py` synthesizes longitudinal weekly
   records for 800 demo students (5 engagement personas, 14 weeks, 2–3
   courses each) with known ground truth.
2. `scripts/train_model.py` recomputes the production `weekly-v1` features
   (40 temporal features: trends, 3-week averages, submission behaviour, LMS
   usage, participation, sentiment — documented in `backend/FEATURES.md`),
   compares logistic regression, HistGradientBoosting and random forest with
   **GroupKFold split by student**, and derives thresholds from out-of-fold
   probabilities (`at_risk` = F2-optimal cut).

Current winner (logistic regression), `outputs/training_report.json`:
**23,562 rows, 800 students, 37.5% positive rate — ROC-AUC 0.9999, PR-AUC
0.9998, Brier 0.0038, log-loss 0.0128, ECE 0.0019** over 5 GroupKFold folds.

- `model_metadata.json` (tracked in git) pins version, checksum, thresholds
  and metrics; the `.joblib` itself is untracked but reproducible.
- The loader hard-fails on checksum mismatch, sklearn version drift,
  unfitted pipeline, wrong feature count/ordering, out-of-range thresholds or
  degenerate probabilities — then `/ready` and all predictions return
  `MODEL_UNAVAILABLE` instead of silently scoring.
- **Honest caveat:** metrics bound the synthetic pipeline, not real-school
  performance. On real consented school data, validity is unproven.

### Explainability (recent work)

- `app/ml/explain.py` computes **exact per-prediction contributions**
  (`coef × standardized value` from the persisted snapshot) with intercept,
  imputed-value annotation and graceful fallback to `feature_importances_`.
- `POST /predictions/what-if` re-scores a stored snapshot with whitelisted,
  range-checked overrides — a simulator only, nothing persisted.

## 7. Frontend

14 pages across three role areas:

- **Teacher:** Dashboard (alerts + risk trajectory charts), Classes, Class
  analytics, Student detail (prediction card with signed contribution bars and
  what-if sliders), Weekly entry (batch + CSV import), Interventions.
- **Admin:** Dashboard, Management CRUD, CSV Imports, Settings.
- **Student:** Dashboard, Progress, Support — no risk data, ever.

Patterns: feature-folder organization, typed API client + TanStack Query for
server state, Zustand for UI state only, Zod-validated forms, Recharts for
risk trajectories, a11y attributes (aria-labels, roles, visually-hidden text)
and responsive media queries (1600 → 600 px + reduced-motion) throughout.

## 8. Testing and verification

- **Backend: 130 tests, 21 files** against a real PostgreSQL — per run a
  unique `eduguard_test_<uuid>` schema runs the full Alembic chain, seeds,
  and rolls back per test (SQLite never substituted).
- **Frontend: 9 suites** with MSW `onUnhandledRequest: "error"`, so unstubbed
  requests fail rather than reach the network.
- Lint: `ruff check` (backend), `eslint --max-warnings 0` (frontend).
- A1/A2 explainability features are covered by tests on both sides (logit
  identity for contributions, monotonic what-if response, authorization).

## 9. Project status

### Shipped

| Area | State |
|---|---|
| Backend milestones 1–7, 9–15 (data model → inference → interventions → dashboards → imports) | ✅ |
| Milestone 8: synthetic-data generator + in-repo retraining pipeline | ✅ |
| Milestone 16: check-in text captured/validated (no classifier yet) | ⚠ |
| Frontend milestones 1–16, 19 (incl. component + MSW integration suites) | ✅ |
| AI alert feed, risk trajectory chart, explanations, recommendations, audit | ✅ |
| **PLAN A1** per-prediction contribution explanations | ✅ implemented end-to-end |
| **PLAN A2** what-if counterfactual simulator | ✅ implemented end-to-end |

### Not yet done

| Item | State |
|---|---|
| PLAN A3 sentiment classifier (2nd model) | ☐ pending |
| PLAN A4 4-week risk forecast with uncertainty cone | ☐ pending |
| PLAN B1–B4 learning loop, PSI drift monitoring, registry UI, model card | ☐ pending |
| PLAN C1–C4 similarity engine, anomaly detector, LLM copilot, archetypes | ☐ stretch |
| Backend M17 (v2 ensemble — blocked), M18 (Calendar), M20 (acceptance test) | ❌ |
| Frontend M17/M18 formal a11y + responsive audit | ◐ partially done |

## 10. Known limitations (stated by the project itself)

- The model is trained on synthetic data sharing one feature builder with
  serving — no train/serve skew, but real-world calibration is unproven.
- Weekly aggregates keyed on `week_start` cannot reconstruct intra-week
  timing; persisted snapshots preserve actual inputs at prediction time.
- No login rate limiting, no password-reset flow, no production
  secrets/backup story, no audit-review tooling; templates endpoint not
  paginated.
- Docker path written but never executed; the 21-step end-to-end acceptance
  test (M20) is not written; frontend tests hit 12 MSW handlers, not the live
  backend, so contract drift would not be caught by CI.
- Nothing is a diagnosis — the system flags a trajectory for a human to review.

## 11. PLAN.md — current expansion roadmap

Reviewer feedback judged the demo "a school management system, not an AI
project," so `PLAN.md` inverts the emphasis toward models, explanations and
learning loops (1–3 month horizon). Sprint order: explainability core
(A1+A2 — **done**) → sentiment model (A3) → learning loop + drift (B1+B2) →
forecast cone (A4) → governance surfaces (B3+B4) → stretch copilot/similarity/
archetypes. End state: 4–5 models with exact explanations, active-learning
retraining, drift monitoring and a grounded LLM teacher copilot.

## 12. Documentation index

| Document | Contents |
|---|---|
| `README.md` | full product, setup, security, model and status reference |
| `PLAN.md` | AI/ML expansion roadmap with sprint design notes |
| `01_BACKEND_ARCHITECTURE.md` / `01_FRONTEND_ARCHITECTURE.md` | tenancy, RBAC, data model, ML contract / UI layout and role boundaries |
| `02_BACKEND_IMPLEMENTATION_PLAN.md` / `02_FRONTEND_IMPLEMENTATION_PLAN.md` | 20 milestones each with acceptance criteria |
| `backend/README.md` | complete API reference and operations guide |
| `backend/FEATURES.md` | the 40 feature formulas and minimum-history rule |
| `backend/IMPORTS.md` | CSV import contract |
| `backend/PROGRESS.md` + `IMPLEMENTATION_REPORT*.md` | milestone trackers and verification records |
| `frontend/README.md` + `frontend/IMPLEMENTATION_REPORT.md` | routes, architecture, run instructions |
| `outputs/` | ER diagrams, slide content, evaluation deck, training report |

## 13. Running it

```powershell
# Backend (this checkout): select .venv312, verify imports, start API
& .\backend\start.ps1

# Retrain the model from scratch (backend/ with venv active)
python -m scripts.generate_synthetic_weekly
python -m scripts.train_model --overwrite

# Migrate, seed, then serve
python -m alembic upgrade head
python -m scripts.seed_demo
python -m scripts.seed_frontend_demo

# Frontend
cd frontend; npm install; npm run dev     # http://localhost:5173
```

Demo login: school slug `demo`, password `EduGuard-Demo-2026!` for
`admin@demo.edu`, `teacher@demo.edu` and `student@demo.edu` (+2 students from
the frontend seed). Interactive API docs: <http://127.0.0.1:8000/docs>.
