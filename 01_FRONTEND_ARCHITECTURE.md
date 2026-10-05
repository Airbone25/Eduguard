# EduGuard Frontend Architecture

> Frontend architecture specification for Codex

## 1. Product workflows

Teacher:

```text
Login
→ see students needing attention
→ open student
→ understand what changed
→ review recommendations
→ create intervention
→ track improvement
```

Student:

```text
Login
→ see progress
→ understand trends
→ see goals/support
→ track improvement
```

Admin:

```text
Login
→ manage school structure
→ manage teachers/students/classes
→ manage course assignments
→ import data
```

The teacher workflow is the main product workflow.

---

## 2. Stack

Use:

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Lucide Icons
React Router
TanStack Query
Zustand
React Hook Form
Zod
TanStack Table
Recharts
```

Recommended testing:

```text
Vitest
React Testing Library
MSW
Playwright later
```

---

## 3. State management

### Server state

Use TanStack Query for:

- current user
- classes
- students
- weekly records
- predictions
- support summaries
- recommendations
- interventions
- admin users
- subjects
- course offerings
- student progress

Example query keys:

```ts
["auth", "me"]
["teacher", "classes"]
["teacher", "class", courseId, "students"]
["teacher", "student", studentId]
["teacher", "student", studentId, "predictions"]
["teacher", "student", studentId, "interventions"]
["student", "me", "dashboard"]
```

### Client state

Use Zustand only for:

- sidebar open/collapsed
- dashboard filters
- selected course if needed
- theme/preferences
- temporary UI state

Do not duplicate server data in Zustand.

---

## 4. Routing

Recommended routes:

```text
/login

/admin/dashboard
/admin/teachers
/admin/students
/admin/classes
/admin/subjects
/admin/courses
/admin/imports
/admin/settings

/teacher/dashboard
/teacher/classes
/teacher/classes/:courseId
/teacher/students/:studentId
/teacher/interventions
/teacher/calendar

/student/dashboard
/student/progress
/student/subjects
/student/goals
/student/support
```

Use protected role routes.

Frontend guards are UX only. Backend authorization remains authoritative.

---

## 5. Folder structure

```text
frontend/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   ├── queryClient.ts
│   │   └── authProvider.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── charts/
│   │   └── common/
│   ├── features/
│   │   ├── auth/
│   │   ├── admin/
│   │   ├── classes/
│   │   ├── students/
│   │   ├── weekly-records/
│   │   ├── predictions/
│   │   ├── interventions/
│   │   └── progress/
│   ├── pages/
│   │   ├── admin/
│   │   ├── teacher/
│   │   └── student/
│   ├── lib/
│   │   ├── api/
│   │   ├── permissions.ts
│   │   ├── routes.ts
│   │   └── utils.ts
│   ├── stores/
│   │   └── uiStore.ts
│   ├── types/
│   └── main.tsx
├── public/
├── package.json
├── vite.config.ts
└── .env.example
```

---

## 6. API layer

Do not call raw fetch/Axios directly inside page components.

Create one configured API client:

```text
src/lib/api/client.ts
src/lib/api/auth.ts
src/lib/api/admin.ts
src/lib/api/teacher.ts
src/lib/api/student.ts
src/lib/api/predictions.ts
src/lib/api/interventions.ts
```

Environment:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

The client should handle:

- base URL
- auth headers/cookies
- refresh behavior if applicable
- consistent errors
- request cancellation where useful

---

## 7. Visual design

EduGuard should feel like a calm education analytics product.

Use:

- neutral/light backgrounds
- clear typography
- generous whitespace
- restrained color
- subtle borders/shadows
- rounded cards
- strong hierarchy
- meaningful charts

Avoid:

- excessive gradients
- neon dashboards
- glassmorphism everywhere
- excessive animation
- alarm-heavy red UI

Teacher-facing support labels:

```text
Doing Well
Watch
Support Recommended
Priority Support
```

Student-facing UI should focus on progress instead of raw model risk.

Never rely on color alone.

---

## 8. Shared layout

Desktop:

```text
┌──────────────────────────────────────────────────────┐
│ Top Bar                                              │
├───────────────┬──────────────────────────────────────┤
│ Sidebar       │ Main Content                         │
│ Dashboard     │                                      │
│ Classes       │                                      │
│ Interventions │                                      │
│ ...           │                                      │
└───────────────┴──────────────────────────────────────┘
```

Recommended sidebar width: about 240px.

Use a mobile drawer for teacher/admin.

Student mobile navigation may use bottom tabs.

---

## 9. Teacher dashboard

This is the first polished screen.

Header:

```text
Good afternoon, Ms Sharma
Grade 10-A · Mathematics
```

Summary cards:

```text
38 Students
5 Priority Support
9 Watch
24 Doing Well
7 Active Plans
```

Main table:

```text
Student
Support Status
Trend
Attendance
Average Score
Main Signal
Intervention
```

Filters:

```text
All
Priority Support
Support Recommended
Watch
Doing Well
```

Also allow class/subject/trend/intervention filters.

Use TanStack Table.

---

## 10. Teacher student detail

Route:

```text
/teacher/students/:studentId
```

Header:

```text
Name
Roll number
Class
Support status
Last updated
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

Overview cards:

```text
Attendance
Average Score
Assignments
Trajectory
```

Show a useful 8-week chart.

Then show:

```text
Why EduGuard flagged this student
```

Only show measurable explanations from backend data.

Examples:

```text
Attendance decreased by 9.4 percentage points.
Average assessment score decreased by 11.2 points.
Three assignments were submitted late consecutively.
```

Do not invent explanations.

---

## 11. Recommendations and interventions

Recommendation card:

```text
recommendation name
why it matches
optional duration/frequency
Start Intervention
```

Teacher must explicitly create the intervention.

Intervention form:

```text
student
template
title
start date
review date
goal
frequency
student visibility
```

After creation show:

```text
status
goal
progress
next review
updates
```

---

## 12. Weekly data entry

Use spreadsheet-like batch entry.

Example:

```text
Week: Sep 28 – Oct 4
Class: Grade 10-A
Subject: Mathematics

Student      Attendance   Score   Assignments   Late
Riya         4/5          62      3/4           1
Arjun        5/5          73      4/4           0
Neha         4/5          81      4/4           0
```

Actions:

```text
Save Draft
Submit Week
Import CSV
```

Do not ask teachers to enter derived ML features.

---

## 13. Student dashboard

Student UI should be positive and progress-oriented.

Example cards:

```text
Attendance
91%
↑ 3%

Average Score
74%
↑ 6

Assignments
8 / 9

On-time streak
3 weeks
```

Primary chart:

```text
Your Progress
```

Switch:

```text
Scores | Attendance | Assignments
```

Time ranges:

```text
4 weeks | 8 weeks | Term
```

Then show:

```text
You improved in
Focus this week
Visible support plans
```

Do not show raw internal risk probability by default.

---

## 14. Gamification

Use self-referenced achievements:

```text
3-week consistency streak
5 assignments on time
Math +10%
Weekly goal completed
Personal best
```

Avoid public class ranking.

---

## 15. Admin experience

Admin sidebar:

```text
Dashboard
Teachers
Students
Classes
Subjects
Courses
Imports
School Settings
```

Dashboard:

```text
Teachers
Students
Classes
Active Courses
Recent Imports
Data Completeness
```

Use searchable/filterable tables.

Bulk import should be prominent.

---

## 16. Forms

Use:

```text
React Hook Form
Zod
```

Every form should have:

- field-level validation
- server error display
- disabled submit while saving
- clear success state

---

## 17. Tables and charts

Use TanStack Table for complex tables.

Reusable table features:

```text
sorting
filtering
pagination
row actions
loading
empty states
```

Use Recharts through wrapper components:

```text
ScoreTrendChart
AttendanceTrendChart
ClassPerformanceChart
SupportDistributionChart
```

Charts need text summaries for accessibility.

---

## 18. Loading, empty, error states

Use skeletons instead of global spinners where possible.

Create reusable empty states.

Example:

```text
No active support plans

You haven't created an intervention yet.

[View Recommendations]
```

User-facing errors should be clear:

```text
We couldn't generate the latest student insight.

Existing academic data is still available.

[Try Again]
```

---

## 19. Accessibility

Required:

- semantic HTML
- keyboard focus
- labelled inputs
- accessible dialogs
- sufficient contrast
- status text in addition to color
- chart summaries
- reduced motion support

Prefer shadcn/Radix primitives over custom inaccessible controls.

---

## 20. Responsive behavior

Teacher/admin:

- desktop-first
- tablet-friendly
- functional mobile fallback

Student:

- mobile-first priority

Student mobile tabs may be:

```text
Home
Progress
Goals
Support
Profile
```

---

## 21. Reusable domain components

Build:

```text
SupportBadge
TrendIndicator
MetricCard
StudentAttentionRow
RiskSignalCard
RecommendationCard
InterventionCard
ProgressChart
AttendanceChart
ScoreTrendChart
AchievementBadge
EmptyState
ErrorState
DataTable
PageHeader
SectionHeader
```

Pages should compose these components.

---

## 22. Frontend MVP definition

Frontend MVP is complete when:

1. login works;
2. role redirects work;
3. admin/teacher/student layouts exist;
4. teacher sees assigned classes;
5. teacher sees attention list;
6. teacher opens student detail;
7. teacher sees measurable explanations;
8. teacher sees recommendations;
9. teacher creates/tracks intervention;
10. teacher submits weekly data;
11. student sees progress;
12. student does not see internal raw risk probability;
13. admin manages core school entities;
14. loading/empty/error states exist;
15. responsive behavior is acceptable;
16. accessibility is respected;
17. build/lint/tests pass.

---

## 23. Non-negotiable rules

1. TanStack Query handles server state.
2. Keep Zustand small.
3. Do not duplicate backend entities in Zustand.
4. Do not expose raw risk to students by default.
5. Do not make teachers enter derived ML features.
6. Do not auto-create interventions.
7. Do not use color alone for status.
8. Do not depend on frontend-only security.
9. Do not scatter raw fetch calls across pages.
10. Avoid `any` for core API data.
11. Keep one codebase for all roles.
12. Keep role experiences distinct.
13. Add loading/empty/error states from the start.
14. Build reusable domain components.
