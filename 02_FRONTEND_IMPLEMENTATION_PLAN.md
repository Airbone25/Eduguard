# EduGuard Frontend Implementation Plan

> Read `01_FRONTEND_ARCHITECTURE.md` before implementing.

## Milestone 1 — Bootstrap

Create React + TypeScript + Vite app.

Install/configure:

- Tailwind
- shadcn/ui
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- TanStack Table
- Recharts
- Lucide
- Vitest
- React Testing Library

Create:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Acceptance:

```bash
npm run dev
npm run build
npm run lint
npm run test
```

---

## Milestone 2 — Design system and layouts

Build:

```text
AuthLayout
AdminLayout
TeacherLayout
StudentLayout
```

Shared components:

```text
PageHeader
MetricCard
SupportBadge
TrendIndicator
LoadingSkeleton
EmptyState
ErrorState
```

Test desktop/tablet/mobile behavior.

---

## Milestone 3 — Authentication and role routing

Implement:

```text
/login
/admin/*
/teacher/*
/student/*
```

Create:

```text
AuthProvider
ProtectedRoute
RoleRoute
```

Use React Hook Form + Zod.

Role redirect:

```text
school_admin -> /admin/dashboard
teacher -> /teacher/dashboard
student -> /student/dashboard
```

Acceptance:

- unauthenticated users are redirected;
- wrong roles cannot enter other role UIs;
- valid session restores after refresh.

---

## Milestone 4 — API and TanStack Query foundation

Create:

```text
src/lib/api/client.ts
src/app/queryClient.ts
```

Feature APIs:

```text
auth
admin
teacher
student
predictions
interventions
```

Create hooks:

```text
useMe
useTeacherClasses
useTeacherClassStudents
useStudentDetails
```

No raw page-level fetch calls.

---

## Milestone 5 — Teacher dashboard

Page:

```text
/teacher/dashboard
```

Sections:

1. greeting/header
2. class selector
3. summary cards
4. attention-needed table
5. filter chips
6. active intervention summary

Summary cards:

```text
Students
Priority Support
Watch
Doing Well
Active Plans
```

Table:

```text
Student
Support Status
Trend
Attendance
Average Score
Main Signal
Intervention
```

Implement loading, empty, error, and populated states.

---

## Milestone 6 — Student detail for teacher

Page:

```text
/teacher/students/:studentId
```

Header:

```text
name
roll number
class
support status
last updated
```

Tabs:

```text
Overview
Academics
Attendance
Assignments
Interventions
History
```

Overview:

```text
Attendance
Average Score
Assignments
Trajectory
8-week chart
Why EduGuard flagged this student
```

Use backend explanations only.

---

## Milestone 7 — Recommendations and intervention creation

Build RecommendationCard.

Create intervention dialog/sheet.

Fields:

```text
template
title
start date
review date
goal
frequency
student visibility
```

On success:

- show toast
- close dialog
- invalidate relevant queries

---

## Milestone 8 — Intervention tracking

Routes/screens:

```text
/teacher/interventions
student intervention tab
```

Show:

```text
status
goal
dates
progress
updates
```

Actions:

```text
add update
edit
complete
cancel
```

---

## Milestone 9 — Class analytics

Page:

```text
/teacher/classes/:courseId
```

Tabs:

```text
Students
Performance
Attendance
Assignments
Interventions
```

Charts:

```text
performance trend
attendance distribution
support distribution
```

Add text summaries.

---

## Milestone 10 — Weekly data entry

Create batch editable table.

Core fields:

```text
Student
Classes Held
Classes Attended
Assessment Average
Assignment Count
Late Submissions
Assignment Average
Quiz Average
Study Hours
Participation
```

Actions:

```text
Save Draft
Submit Week
Import CSV
```

Do not include derived ML features.

---

## Milestone 11 — Admin dashboard

Routes:

```text
/admin/dashboard
/admin/teachers
/admin/students
/admin/classes
/admin/subjects
/admin/courses
/admin/imports
/admin/settings
```

Dashboard cards:

```text
Teachers
Students
Classes
Active Courses
Recent Imports
```

---

## Milestone 12 — Admin management

Implement CRUD-style management for:

```text
teachers
students
classes
subjects
course offerings
assignments/enrollments
```

Use searchable/filterable tables.

---

## Milestone 13 — CSV import UX

Flow:

```text
choose import type
upload
validate
preview
show errors
confirm
show result
```

Show row-level errors.

---

## Milestone 14 — Student dashboard

Page:

```text
/student/dashboard
```

Show:

```text
Attendance
Average Score
Assignments
On-time Streak
Progress Chart
Improvement Highlights
Focus This Week
Visible Support Plans
```

Do not show raw internal risk fields.

---

## Milestone 15 — Student progress

Page:

```text
/student/progress
```

Toggles:

```text
Scores
Attendance
Assignments
```

Ranges:

```text
4 weeks
8 weeks
Term
```

Use self-comparison.

---

## Milestone 16 — Goals and gamification

Routes:

```text
/student/goals
/student/support
```

Achievements:

```text
consistency streak
assignments on time
score improvement
attendance improvement
goal completed
personal best
```

No public ranking.

---

## Milestone 17 — Accessibility pass

Audit:

- keyboard navigation
- focus
- labels
- dialogs
- contrast
- status text
- chart summaries
- reduced motion

---

## Milestone 18 — Responsive pass

Test:

Teacher/admin:

```text
1440
1280
1024
768
mobile fallback
```

Student:

```text
mobile
tablet
desktop
```

---

## Milestone 19 — Testing

Component tests:

```text
SupportBadge
TrendIndicator
ProtectedRoute
login validation
teacher dashboard states
student privacy
intervention form
weekly entry validation
```

Use MSW.

Later Playwright:

```text
login
teacher opens student
teacher creates intervention
student sees progress
admin adds user
```

---

## Milestone 20 — Final acceptance

Manual/E2E checklist:

```text
1. teacher login
2. teacher dashboard
3. class selection
4. attention list
5. student detail
6. explanations
7. recommendations
8. create intervention
9. intervention visible
10. weekly data entry
11. student login
12. progress visible
13. no raw risk shown
14. admin login
15. management screens
16. create school entities
17. loading state
18. empty state
19. API error state
20. mobile student experience
```

Run:

```bash
npm run build
npm run lint
npm run test
```

---

## Recommended order

```text
1  bootstrap
2  design system
3  auth/routing
4  API/query layer
5  teacher dashboard
6  student detail
7  recommendations/interventions
8  intervention tracking
9  class analytics
10 weekly entry
11 admin dashboard
12 admin management
13 imports
14 student dashboard
15 student progress
16 gamification
17 accessibility
18 responsiveness
19 tests
20 final verification
```

## First Codex execution target

Complete only Milestones 1-5.

Do not attempt the entire frontend in the first pass.

After Milestones 1-5, report:

- files changed
- routes created
- state management used
- APIs wired
- mock data still used
- test/build/lint results
- exact startup command
