# EduGuard Frontend — Codex Start Here

You are implementing the EduGuard frontend.

Read these files before writing code:

1. `01_FRONTEND_ARCHITECTURE.md`
2. `02_FRONTEND_IMPLEMENTATION_PLAN.md`

Also inspect the existing backend API and backend specification files if present.

## First execution scope

Implement only:

1. React + TypeScript + Vite bootstrap
2. design system and app shell
3. authentication and role-based routing
4. API client + TanStack Query provider
5. teacher dashboard foundation

Do not build the whole frontend in one pass.

## Required stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Lucide icons
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- TanStack Table
- Recharts

## State rule

Use TanStack Query for server state.

Use Zustand only for small client UI state such as sidebar state, filters, theme, and temporary preferences.

Do not copy students, classes, predictions, interventions, or other backend entities into Zustand.

## Role experiences

Build role-specific experiences for:

- School Admin
- Teacher
- Student

They should share the same design system but not be identical dashboards.

## First-pass screens

Implement:

- Login
- Protected routes
- Role redirect after login
- Teacher layout
- Teacher dashboard
- Class list foundation
- Student detail foundation
- Admin layout placeholder
- Student layout placeholder

The teacher dashboard is the first polished screen.

It should support:

- class selector
- summary cards
- attention-needed student table
- support badges
- trend indicators
- loading skeleton
- empty state
- error state

## Verification

Run:

```bash
npm run build
npm run lint
npm run test
```

At the end report:

1. files created/changed
2. routes implemented
3. components implemented
4. state-management choices
5. API endpoints wired
6. mocked data still in use
7. build/lint/test results
8. exact command to start the frontend
9. anything incomplete

Do not continue to later milestones until the foundation is stable.
