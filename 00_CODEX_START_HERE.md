# EduGuard — Codex Start Here

You are implementing the EduGuard backend.

Before writing code, read these files in order:

1. `01_BACKEND_ARCHITECTURE.md`
2. `02_BACKEND_IMPLEMENTATION_PLAN.md`

Also inspect the existing project assets if they are present:

- `EduGuard_AI_Risk_Detection_Colab.ipynb`
- `student_dataset_enriched.csv`
- `eduguard-ai-v2-model-plan.md`

## First execution scope

Implement **only Milestones 1-3** from `02_BACKEND_IMPLEMENTATION_PLAN.md`:

1. FastAPI + PostgreSQL project bootstrap
2. core multi-tenant school data model
3. authentication + RBAC

Do not implement the frontend yet.

Do not implement ML inference yet.

Do not delete or rewrite the supplied notebook, dataset, or model-plan files.

Create the backend under `backend/` unless the repository already contains an established backend structure that should be preserved.

## Required result of the first pass

The repository should have:

- FastAPI application;
- PostgreSQL via Docker Compose;
- SQLAlchemy models;
- Alembic migrations;
- school/admin/teacher/student core entities;
- classrooms, subjects, course offerings, teacher assignments, and enrollments;
- JWT access/refresh authentication;
- Argon2 password hashing;
- role-based authorization;
- `/health`;
- `/ready`;
- `/docs`;
- seed script;
- automated tests.

Run and fix all failures before stopping:

```bash
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api pytest
docker compose exec api ruff check .
```

At the end, report:

1. files created/changed;
2. implemented endpoints;
3. migration revision;
4. seeded demo accounts;
5. test results;
6. exact command to start the backend;
7. any blocker that prevents Milestones 1-3 from being complete.

After the first pass is stable, continue through the remaining milestones in order from `02_BACKEND_IMPLEMENTATION_PLAN.md`.
