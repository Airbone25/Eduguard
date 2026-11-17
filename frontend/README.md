# EduGuard frontend

Implements the teacher, administrator, and student workflows from the frontend specifications. This continuation adds Milestones 6–16, accessibility/responsive work, tests, and acceptance verification. See `IMPLEMENTATION_REPORT.md` for exact verification coverage and limitations. The notebook, dataset, and pretrained model artifact are unchanged.

## Start locally

Use Node 24 LTS (verified with 24.15.0) and npm. From the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. On Windows, use `npm.cmd` instead of `npm` if PowerShell script execution policy blocks npm.ps1. The dev server uses a fixed port to match the backend CORS origin. The default API URL is `http://localhost:8000/api/v1`; to override it, copy `.env.example` to `.env.local` and edit `VITE_API_URL`. Never put secrets in `VITE_*` variables; they are public browser configuration.

Run the existing backend in another terminal from the repository root:

```powershell
cd backend
.\start.ps1
```

Use the backend's configured development database. Existing demo school code: `demo`; teacher email: `teacher@demo.edu`; administrator: `admin@demo.edu`; student: `student@demo.edu`. The development seed password is documented in the backend README. Data changes happen only through explicit form submissions; the frontend does not fabricate school measurements.

Run `python -m alembic upgrade head` with the backend virtual environment before starting an upgraded backend. Revision `0009_frequency` adds optional intervention frequency. For a separate synthetic school with three enrolled students and seven historical weeks, run `python -m scripts.seed_frontend_demo` from `backend/`. This development-only script uses school code **frontend-demo**, leaves existing schools untouched, and does nothing if that fixture already exists. Accounts are `admin@demo.edu`, `teacher@demo.edu`, `student@demo.edu` (Riya), `student2@demo.edu` (Arjun), and `student3@demo.edu` (Neha), all using **EduGuard-Demo-2026!**. Current-week data is left empty so weekly entry can be exercised. Acceptance verification has added a current record and support plan for Riya in this development database.

## Checks

```powershell
npm run build
npm run lint
npm run test
```

Tests use Vitest, React Testing Library, and MSW. Mock fixtures exist only in `src/test`; they are not imported by the application and no service worker is registered in production. `npm run test:watch` is available for development. See `IMPLEMENTATION_REPORT.md` for verification results and scope limits.

## Structure and ownership

- `src/app`: providers, query configuration, authentication bootstrap, lazy routes.
- `src/components/ui`: shadcn-style source-owned Button and Sheet, built with CVA, Radix Slot/Dialog and `cn`. `components.json` is configured for future shadcn additions.
- `src/components/common`: page headings, metrics, support/trend badges, skeletons, empty/error states, paginated TanStack Table.
- `src/components/layout`: role-aware desktop sidebar/topbar and accessible mobile drawer.
- `src/features`: auth guards/context, typed query hooks and student attention table.
- `src/pages`: login; teacher dashboard, student detail, class analytics, weekly entry and intervention tracking; admin management/imports/settings; student dashboard/progress/goals/support.
- `src/features/admin`, `interventions`, `weekly-records`, `progress`: typed API/query adapters, validation schemas, forms and presentation logic.
- `src/components/charts`: Recharts visualizations with accessible summaries and weekly value tables.
- `src/lib/api`: centralized transport plus separate auth, teacher, admin, student, prediction, intervention adapters.
- `src/types`: backend response contracts. Student response types exclude internal risk fields.
- `src/stores/uiStore.ts`: only selected course, filters, sorting and drawer state.
- `src/styles.css`: Tailwind v4 integration, design tokens and responsive component styles.

TanStack Query owns current user, courses, rosters, summaries and progress. No backend entities are stored in Zustand. Requests receive Query's cancellation signal; logout clears the query cache and UI state. Page components do not use fetch directly.

## Authentication contract

The existing backend returns bearer access/refresh tokens in JSON, not HttpOnly cookies. Tokens are held in memory and mirrored into **sessionStorage** for reload restoration; the current user always comes from the authenticated backend/query cache. They are never placed in URLs, localStorage, logs, or Zustand. Storage-disabled browsers fall back to an in-memory session.

401 responses trigger one shared refresh request, then one retry. Refresh token rotation is supported. Authorization failures (403) are not retried as token expiry. Late responses from an earlier account cannot populate a new session. Logout during refresh prevents session resurrection and attempts to revoke the rotated token. A failed server logout still clears local data and displays the revocation limitation on login.

Browser storage remains accessible to JavaScript. A future production hardening pass should coordinate HttpOnly/Secure cookie support with the backend, CSP and deployment configuration. Frontend role guards are navigation conveniences; backend tenant and teacher-assignment checks remain authoritative.

## Data semantics

- `/teacher/classes` now includes real classroom and subject names. Teachers never query administrator APIs.
- The backend supports `priority_support`, `watch`, `doing_well`, `not_assessed`. There is no distinct `support_recommended` category, so the UI does not manufacture it.
- The **Active Plans** card is explicitly subtitled **Students with an open plan**. It counts students whose backend `active_intervention` flag is true; that flag includes planned and active interventions. It is not a count of intervention rows.
- All summary pages are loaded before local filtering, pagination and intervention counts. Follow-up pages use the first page's `as_of_date`. Changing/duplicate rosters raise a retryable error rather than displaying a partial class as complete. A 20,000-row ceiling fails visibly.
- All four backend sort modes are wired. Local support, trend, plan-status and name/roll-number filters combine across the loaded class. The combined course selector is the available class/subject filter.
- Missing metrics stay `—`; absent assessments do not imply Doing Well. Missing history does not imply Stable. Explanations are copied from backend `top_signal` only.
- Teachers enter raw observations only. The backend derives features and runs the existing pretrained artifact when Generate insight is explicitly selected. Recommendations are backend-authored and require an explicit Save before creating a plan.
- Weekly batch entry preserves earlier weeks, loads all existing fields before editing, and distinguishes missing values from zero. Drafts are memory-only and are cleared on reload/sign-out. CSV import is reviewed before submission; admin imports additionally use server-side validation and explicit confirmation.
- Student screens use only `/student/me/*` responses. Internal probabilities, risk labels, explanations and teacher notes are never rendered. Goals and achievements are based on recorded personal progress, with no rankings.
- Term view asks for the dates provided by the school, fetches the bounded history using the selected end date, and displays only weeks starting inside that term. Date order and a 52-calendar-week maximum are validated; future end dates are rejected. School-wide saved term configuration is not yet available.
- Admin management preserves history: accounts/classes/courses deactivate; enrollments withdraw/re-enroll; teacher assignments can be removed. Subject names can be edited; subject codes and existing academic-year/context keys stay fixed.

## Deployment notes

`npm run build` produces `dist/`. Configure static hosting to fall back to `index.html` for browser-router deep links. Configure the backend's CORS allowlist for the actual frontend origin. `npm run preview` is a local build preview, not a production server.

Charts and role-specific pages are lazy-loaded. Class history analytics currently fetch per-student progress with four concurrent requests; a dedicated aggregate backend endpoint would improve performance for large schools.


