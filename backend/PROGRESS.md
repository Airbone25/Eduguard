# Dashboard and progress contracts

All routes use `/api/v1`. Dates default to today's UTC date. Academic metrics use the existing
eight-calendar-week feature window through `as_of_date`; future weekly records are excluded.
Current values mean the week containing that date. A missing current week remains null.

## Teacher views

`GET /teacher/classes/{course_id}/risk-summary` requires an active teacher assignment. Only
active students with active, started enrollments in that course are included. The response has
`course`, `as_of_date`, whole-class `counts`, and paginated `students` (`limit` 1–200, `offset`).
Counts are calculated before pagination. The service uses bulk queries, not SQL per student.

Each student has name, roll number, support level, prediction date, trajectory, newly-declining
flag, current score/attendance, top saved signal and an intervention flag. The latest prediction
is selected by snapshot date, then creation time/ID, with snapshot date no later than the cutoff.
Students without a prediction have `not_assessed`, never a fabricated low-risk classification.

Sort modes:

- `attention` (default): priority support, watch, not assessed, doing well; newly declining and
  declining first within a support group, followed by name and ID.
- `name`: case-insensitive name, then ID.
- `attendance` and `score`: lowest observed values first, nulls last, then name and ID.

Trajectory uses four-week changes. Attendance changes of at least 8 percentage points or score
changes of at least 10 points produce improving/declining signals; decline takes precedence if
the measures disagree. Smaller known changes are stable; neither change available means
`insufficient_history`. `newly_declining` requires a current decline and an observed stable or
improving trajectory one week earlier. Sorting is advisory and performs no action.

`active_intervention` means a currently planned/active intervention in this course whose start
date is on/before the cutoff. It does not reconstruct earlier versions of an intervention's status.
Saved prediction signals may be older than current metrics; `prediction_as_of_date` makes this visible.

`GET /teacher/students/{student_id}/progress?course_offering_id=...&as_of_date=...` provides
measured weekly progress for an authorized student/course, including subsequent metrics for
intervention review. A teacher cannot select another course merely because the student is shared.

## Student views

- `GET /student/me/dashboard`
- `GET /student/me/progress`
- `GET /student/me/interventions`
- `GET /student/me/goals`

The identity comes exclusively from the authenticated student. Optional `course_offering_id`
must be one of their active enrollments in an active course/classroom. Dashboard/progress accept
`as_of_date`; metrics are returned per course rather than blending unlike courses into one score.

Each course contains attendance/academic current values, four-week changes/trends, raw weekly
progress, assignment completion, measured on-time streaks and positive self-comparison events.
No risk probability, risk label, at-risk flag, model explanations, severity, prediction IDs,
check-in text, private notes or intervention update details are serialized. No prediction is run
when viewing progress. Intervention/goal responses use explicit whitelists, including goal keys.

Only `visibility_to_student=true` interventions belonging to that student in accessible courses
are returned. Intervention notes stay private even when the action is visible. Goals include only
attendance and assessment-score targets. Interventions/goals reflect current visibility/state,
not historical status at `as_of_date`. They support `limit`/`offset`; dashboards include the first
100 visible interventions and `interventions_has_more` to indicate further pages.

## Assignment completion

The optional raw field `assignments_completed` was added because assignment count and late
submissions do not establish completion. Existing records remain null, with no backfill. Raw
validation enforces completed ≤ total and late ≤ completed whenever both values are known.

Completion percentage is `100 * completed / total`, with null for missing data or zero total.
An on-time streak counts consecutive calendar weeks with a positive total, all assignments
completed, and zero late submissions. A known missed/late week or zero-assignment week ends
the streak. Missing weeks/counts leave the streak unknown rather than bridging the gap. Streaks
are bounded by the eight-week observed window. The existing 40-feature ML contract is unchanged.
