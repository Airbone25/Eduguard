# EduGuard frontend continuation report

Verified on October 4–6, 2026. This report supersedes the first-pass Milestones 1–5 report.

## Scope

Continued the existing frontend rather than rebuilding it. Milestones 6–16 now have working teacher, admin, and student workflows. Milestones 17–19 add accessibility/responsive checks and automated coverage. The Milestone 20 checklist is covered by live browser verification plus component/API tests, with the precise limits listed below.

The notebook, dataset, pretrained joblib, and model-training logic were not changed. No model was retrained.

## Implemented workflows

- M6: student detail with Overview, Academics, Attendance, Assignments, Interventions, and History; eight-week charts with missing-week gaps; backend explanations and saved insight history.
- M7: backend recommendation cards and explicit intervention creation with template, title, dates, frequency, goals, and student visibility.
- M8: teacher-wide/class/student intervention lists; editing, activation, private follow-ups, completion and cancellation. Status changes invalidate cached teacher data.
- M9: class roster, performance, attendance, assignments, support distribution, and interventions. Class analytics use measured values only and disclose missing observations.
- M10: selected-row weekly batch entry, field/count validation, session drafts, and CSV preview. Only raw school fields are accepted. Existing hidden fields are loaded before editing; other weeks are retained.
- M11–12: school dashboard; searchable, paginated teacher/student/class/subject/course management; user and structure editing/deactivation; teacher assignments/removal; enrollment/withdrawal/re-enrollment; school-name settings.
- M13: CSV type/context selection, preview, server validation, row-level errors, explicit confirmation, result, and import history. Passwords are omitted from preview; generated initial credentials are shown only from the initiating response and can be dismissed.
- M14–16: student dashboard, score/attendance/assignment charts, personal improvement highlights, on-time streaks, visible plans and measured goals. No internal model probability, risk label, or private teacher notes are rendered. No public ranking or fabricated achievements.
- M17–18: labelled controls, accessible error/status messages, Radix focus-trapped dialogs with focus restoration, chart data alternatives, reduced-motion CSS, responsive navigation, tables and student cards.
- M19: expanded Vitest/RTL/MSW and PostgreSQL authorization tests.

## Routes

Teacher: `/teacher/dashboard`, `/teacher/classes`, `/teacher/classes/:courseId`, `/teacher/classes/:courseId/weekly`, `/teacher/students/:studentId?course=...`, `/teacher/interventions`.

Admin: `/admin/dashboard`, `/admin/teachers`, `/admin/students`, `/admin/classes`, `/admin/subjects`, `/admin/courses`, `/admin/imports`, `/admin/settings`.

Student: `/student/dashboard`, `/student/progress`, `/student/goals`, `/student/support`.

## Backend integration changes

All paths below use `/api/v1`:

- `GET /teacher/interventions` — assigned-course, school-scoped aggregate list with optional course/status filters.
- `GET /admin/teachers`, `GET /admin/students` — paginated profiles with safe user data.
- `PATCH /admin/classes/{id}`, `/admin/subjects/{id}`, `/admin/course-offerings/{id}`.
- `GET /admin/course-offerings/{id}/teachers` and `/students`.
- `DELETE /admin/course-offerings/{id}/teachers/{teacher_id}`.
- `PATCH /admin/enrollments/{id}`.
- `GET/PATCH /admin/settings` — current school only; school slug/auth settings are not editable.
- `GET /teacher/classes` now returns real class/subject names.
- `GET /student/me/progress` accepts `history_weeks` from 1 to 52; default remains eight. Queries exclude future weeks.
- Intervention create/edit/read supports an optional frequency field.

Business logic remains in services; routes enforce existing role dependencies. New operations have school isolation and wrong-role tests. Deactivation/withdrawal retains learning history.

Database migration: **`0009_frequency`**, parent **`0008_imports`**, adds nullable `interventions.frequency` (varchar 200). No other database columns were added.

## Files changed

Frontend additions:

- `src/components/charts/{ProgressChart,DistributionChart}.tsx`
- `src/components/common/SectionNav.tsx`, `src/components/ui/modal.tsx`
- `src/lib/api/pagination.ts`
- `src/features/admin/{api.ts,EntityForm.tsx,CourseMembers.tsx}`
- `src/features/interventions/{schema.ts,api.ts,InterventionEditor.tsx,InterventionCard.tsx,InterventionWorkspace.tsx}`
- `src/features/predictions/{hooks.ts,Insights.tsx}`
- `src/features/progress/{metrics.ts,student.ts,StudentSupport.tsx}`
- `src/features/weekly-records/{schema.ts,csv.ts}`
- `src/pages/teacher/{ClassAnalytics,WeeklyEntry,Interventions}.tsx`
- `src/pages/admin/{Dashboard,Management,Imports,Settings}.tsx`
- `src/pages/student/{Dashboard,Progress,Support}.tsx`
- `src/test/{progress.test.ts,weekly.test.ts,interventions.test.tsx,student-admin.test.tsx}`

Frontend updates: router, layout/navigation, teacher student detail, course labels and response types, support types, styles, test setup/handlers/auth assertions, Vite test configuration, README and this report.

Backend additions:

- `app/api/v1/management.py`, `app/services/management_service.py`, `app/schemas/management.py`
- `alembic/versions/0009_frequency_intervention_frequency.py`
- `tests/test_frontend_interventions.py`, `tests/test_frontend_management.py`
- `scripts/seed_frontend_demo.py`

Backend updates: API router; intervention model/schema/service/routes; teacher course schema/service/routes; student progress service/routes.

## Verification

- Frontend production build: passed.
- ESLint with zero warnings allowed: passed.
- Full frontend suite: **47 passed**, seven files.
- Full PostgreSQL backend suite: **130 passed**. The test fixture migrates a fresh isolated schema and rolls back test writes.
- Ruff: passed. Two unreadable temporary pytest-cache directories produce discovery warnings; no source lint errors.
- Development PostgreSQL: `alembic current` reports `0009_frequency (head)`; `alembic check` reports no upgrade operations.
- API `/health`, `/ready`, `/docs`: HTTP 200.
- Build emits two upstream Zod PURE-comment warnings; backend tests emit the existing Starlette/httpx deprecation warning.

Commands were run from `frontend/` and `backend/` respectively using `npm.cmd` and the existing `.venv312` Python on Windows. Tests run in one worker with condition-based async waits to accommodate cold lazy-route compilation on constrained Windows hosts. No Docker verification is claimed; Docker is unavailable in this environment.

### Acceptance evidence

Live browser checks used the real FastAPI API and the configured development PostgreSQL database:

1. Teacher sign-in, dashboard, assigned class selection and attention list loaded.
2. Student detail displayed eight weeks of real synthetic history and preserved missing data.
3. Weekly draft saved; selected raw record submitted successfully while earlier weeks remained.
4. Generate insight used the existing `current-joblib-v1` model; backend explanations and three recommendations appeared.
5. A recommended attendance plan was explicitly saved, made visible, activated, and given a private follow-up.
6. Escape closed the dialog and restored focus to its opening button.
7. Student sign-in showed measured progress and the shared plan; DOM inspection confirmed internal risk fields, Priority Support, and the private note were absent.
8. Mobile student dashboard at 390px had no horizontal page overflow; drawer navigation and progress toggles worked. The explicit September 1–October 3 term displayed exactly four weekly values (September 7, 14, 21, 28), after fixing native date-input event handling. Teacher dashboard was checked at 1440, 1280, 1024, 768, and 390px.
9. Admin sign-in and dashboard loaded; class, subject, and course creation persisted in the isolated synthetic school. Admin class tables fit all five specified widths.
10. Loading, empty, API-error, wrong-role, intervention, import-confirmation, and privacy cases are covered by MSW component tests; permissions, tenant boundaries, and persistence are covered by PostgreSQL tests.

This is manual browser acceptance plus component/API automation, not a committed Playwright end-to-end runner or formal WCAG certification.

## Run

In one terminal, from the repository root:

```powershell
cd backend
.\.venv312\Scripts\python.exe -m alembic upgrade head
.\.venv312\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another:

```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:5173`.

## Demo data

The original `demo` school was retained. The separate **frontend-demo** school contains clearly synthetic data and three enrolled students. Its development-only seed is idempotent and never overwrites an existing school.

| Role | Email | Student |
|---|---|---|
| Admin | admin@demo.edu | — |
| Teacher | teacher@demo.edu | — |
| Student | student@demo.edu | Riya Patel, S001 |
| Student | student2@demo.edu | Arjun Shah, S002 |
| Student | student3@demo.edu | Neha Das, S003 |

Password for all: `EduGuard-Demo-2026!`. School code: `frontend-demo`.

Synthetic historical records end in the week they were seeded. New calendar weeks correctly show missing current measurements until entered; old values are not carried forward.

## Limits and later work

- Term dates are entered explicitly in the progress view because the backend has no school-wide term configuration. The frontend validates date order, prohibits future end dates, bounds the request to 52 calendar weeks, passes the end date as `as_of_date`, and displays only weeks starting inside the selected term. Dates are session UI state, not saved school settings.
- Drafts are memory-only and clear on reload/sign-out. Save before changing week or leaving the page; durable drafts are not implemented.
- Large-class analytics load per-student progress with bounded concurrency. A server aggregate endpoint would improve large-school performance.
- Existing review dates cannot be cleared to null through the backend patch contract; the editor now reports this clearly.
- No standalone Playwright runner, exhaustive assistive-technology audit, or Docker execution was added.
- Existing production-hardening gaps remain, including cookie-based token storage, password reset/rate limiting, deployment/secrets/backup setup. Frontend route guards do not replace backend authorization.
- Sentiment, v2 ensemble training, and calendar/OAuth work remain outside this frontend continuation. The existing pretrained model is unchanged.


