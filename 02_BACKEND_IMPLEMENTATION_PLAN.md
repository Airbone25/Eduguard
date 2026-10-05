# EduGuard Backend Implementation Plan

> Execution plan for Codex  
> Read `01_BACKEND_ARCHITECTURE.md` before implementing this file.

## 0. Codex operating instructions

Work incrementally.

Do not attempt the entire application as one large code generation step.

At the beginning:

1. inspect the existing repository;
2. preserve the uploaded notebook, dataset, and model-plan files;
3. create the backend under `backend/` unless a backend already exists;
4. do not modify frontend code yet;
5. do not delete existing project files;
6. keep the application runnable after every milestone.

After each milestone:

```bash
ruff check .
pytest
```

Also run:

```bash
alembic upgrade head
```

against a clean development database when database migrations change.

If a design detail is unclear, follow `01_BACKEND_ARCHITECTURE.md`.

---

# Milestone 1 — Bootstrap the FastAPI backend

## Goal

Create a clean backend project that starts successfully with PostgreSQL.

## Tasks

Create:

```text
backend/
app/
tests/
scripts/
artifacts/
```

Configure:

- FastAPI;
- Pydantic settings;
- SQLAlchemy;
- PostgreSQL;
- Alembic;
- pytest;
- Ruff;
- Dockerfile;
- Docker Compose;
- `.env.example`.

Implement:

```text
GET /health
GET /ready
```

At this phase `/ready` only needs database readiness.

## Required files

At minimum:

```text
app/main.py
app/core/config.py
app/db/session.py
app/db/base.py
app/api/v1/router.py
app/api/v1/health.py
```

## Acceptance criteria

```bash
docker compose up --build
```

starts:

- PostgreSQL;
- FastAPI.

These work:

```text
GET http://localhost:8000/health -> 200
GET http://localhost:8000/docs -> Swagger
```

`pytest` passes.

---

# Milestone 2 — Core school data model

## Goal

Implement the multi-tenant school structure.

## Models

Implement:

- School
- User
- TeacherProfile
- StudentProfile
- Classroom
- Subject
- CourseOffering
- CourseTeacher
- Enrollment

Use UUIDs.

Add relationships carefully.

Do not rely only on ORM relationship filtering for security.

## Database constraints

Add:

```text
UNIQUE school slug
UNIQUE school + user email
UNIQUE school + student roll number
UNIQUE school + subject code
UNIQUE student + course offering enrollment
```

Create Alembic migration.

## Seed script

Create:

```bash
python scripts/seed_demo.py
```

Seed:

```text
School: Demo Public School
Admin: admin@demo.edu
Teacher: teacher@demo.edu
Student: student@demo.edu
Classroom: Grade 10-A
Subjects: Mathematics, Physics, Chemistry
Course offering: Grade 10-A Mathematics
```

Use development-only documented passwords.

## Acceptance criteria

- migration succeeds from empty DB;
- seed script is idempotent or safely refuses duplicates;
- relationships can be queried;
- School A and School B can coexist.

---

# Milestone 3 — Authentication and RBAC

## Goal

Add secure role-based authentication.

## Implement

Endpoints:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/change-password
```

Use:

- Argon2 password hashing;
- short-lived JWT access token;
- revocable refresh token.

Create reusable dependencies:

```python
get_current_user
require_role
require_school_admin
require_teacher
require_student
```

## Refresh tokens

Create a small database table if needed:

```text
refresh_tokens
```

Store:

- user id;
- token identifier/hash;
- expiry;
- revoked timestamp.

Never store plaintext refresh token.

## Tests

Add tests for:

- correct password;
- incorrect password;
- inactive user;
- wrong role;
- expired token;
- revoked refresh token.

## Acceptance criteria

Swagger authentication works.

An authenticated teacher cannot call an admin-only route.

---

# Milestone 4 — Admin school-management APIs

## Goal

Allow a school administrator to create the school structure.

## Implement endpoints

### Users

```text
GET  /api/v1/admin/users
POST /api/v1/admin/teachers
POST /api/v1/admin/students
PATCH /api/v1/admin/users/{id}
```

### Structure

```text
GET  /api/v1/admin/classes
POST /api/v1/admin/classes

GET  /api/v1/admin/subjects
POST /api/v1/admin/subjects

GET  /api/v1/admin/course-offerings
POST /api/v1/admin/course-offerings
```

### Assignments

```text
POST /api/v1/admin/course-offerings/{course_id}/teachers
POST /api/v1/admin/course-offerings/{course_id}/students
```

## Rules

Admin can modify only their school.

School ID must come from current authenticated admin.

Do not accept an arbitrary school ID from the request body for tenant ownership.

## Acceptance criteria

An admin can create:

```text
teacher
student
class
subject
course
teacher assignment
student enrollment
```

A School A admin cannot edit School B.

---

# Milestone 5 — Teacher access model

## Goal

Teachers can access only students connected to their assigned courses.

## Implement

```text
GET /api/v1/teacher/classes
GET /api/v1/teacher/classes/{course_id}/students
GET /api/v1/teacher/students/{student_id}
```

Create authorization helpers:

```python
teacher_has_course_access()
teacher_has_student_access()
```

A student is accessible when the teacher has a valid course assignment that overlaps a student's valid enrollment.

## Tests

Create at least:

- Teacher A assigned to Student 1;
- Teacher B not assigned to Student 1;
- Teacher B request returns 403/404 according to chosen anti-enumeration strategy.

Use the same behavior consistently.

---

# Milestone 6 — Weekly longitudinal records

## Goal

Store the raw data used to derive ML features.

## Implement model

`WeeklyRecord` from the architecture document.

Do not create columns for every derived feature.

## Endpoints

```text
PUT  /api/v1/teacher/students/{student_id}/weekly-records/{week_start}
GET  /api/v1/teacher/students/{student_id}/weekly-records
POST /api/v1/teacher/weekly-records/batch
```

Require `course_offering_id`.

## Validation

Validate:

```text
0 <= score <= 100
counts >= 0
classes_attended <= classes_held
late_submissions <= assignment_count
1 <= confidence <= 5
```

Null values are allowed where source data does not exist.

## Update semantics

Unique key:

```text
student_id
course_offering_id
week_start
```

PUT may update the existing record.

Write an audit entry for updates.

## Acceptance criteria

A teacher can enter 8 weeks for a student.

History stays intact.

Week 8 does not overwrite Week 7.

---

# Milestone 7 — Feature engineering service

## Goal

Convert weekly history to a model-ready feature snapshot.

## Create

```text
app/ml/feature_definitions.py
app/ml/feature_builder.py
app/services/feature_service.py
```

## Features

Implement the supported subset in stages.

### Level A — current/aggregate

```text
attendance_percent
avg_score
score_std
study_hours_weekly
assignment_count
late_submissions
on_time_submissions
last_minute_submission_rate
avg_submission_delay_days
assignment_avg_score
quiz_count
quiz_attempt_count
quiz_avg_score
quiz_score_volatility
lms_login_count
lms_active_days
avg_lms_session_min
total_lms_time_min
days_since_last_login
participation_count
participation_rate
sentiment_score (only when produced by a separate pipeline)
```

### Level B — temporal

Use up to the most recent 4-8 weeks as available.

```text
attendance_change_4wk
score_change_4wk
study_hours_change_4wk

attendance_3wk_avg
score_3wk_avg
study_hours_3wk_avg

attendance_volatility
score_volatility
study_hours_volatility

attendance_slope
score_slope
study_hours_slope

late_submission_streak
low_score_streak
engagement_score
academic_consistency
```

## Rules

The builder must:

1. sort by week;
2. use records only up to `as_of_date`;
3. never use future rows;
4. return missing values when history is insufficient;
5. return feature metadata including number of weeks used.

## Tests

Create fixed example histories.

Assert exact calculations for:

- attendance percent;
- 3-week rolling mean;
- 4-week difference;
- standard deviation/volatility;
- slope;
- late streak.

## Acceptance criteria

Same history always produces the same feature dictionary.

Future weeks do not change a historical prediction snapshot.

---

# Milestone 8 — Convert the notebook into a training script

## Goal

Move training logic out of Colab and create a reproducible model artifact.

## Source

Use:

```text
EduGuard_AI_Risk_Detection_Colab.ipynb
student_dataset_enriched.csv
```

Do not directly execute the notebook from the API.

## Create

```text
app/ml/training.py
scripts/train_model.py
```

Command:

```bash
python scripts/train_model.py \
  --data ../student_dataset_enriched.csv \
  --output artifacts/eduguard_model_bundle.joblib
```

## Baseline excluded fields

Replicate the notebook exclusion logic.

Exclude:

```text
Student_Names
Phone_No.
Student Address
Roll No.
Comment
Weekly_Feedback
Sentiment_Label
At_Risk
Risk_Level
Risk_Score
Grade
School Name
```

Target:

```text
At_Risk
```

## Models

Reproduce:

- Logistic Regression;
- Random Forest;
- Gradient Boosting.

Calculate:

- accuracy for reference;
- precision;
- recall;
- F1;
- ROC-AUC.

Prefer recall/F1 for model discussion rather than accuracy alone.

## Bundle format

Save:

```python
{
    "model": model,
    "feature_names": feature_names,
    "model_name": model_name,
    "model_version": model_version,
    "feature_version": feature_version,
    "metrics": metrics,
    "thresholds": {
        "medium": 0.40,
        "high": 0.65,
        "at_risk": 0.50
    }
}
```

## Critical leakage rule

Never train using:

```text
Risk_Score
Risk_Level
At_Risk as a feature
```

## Acceptance criteria

The script creates a loadable `.joblib` artifact.

A test loads it and successfully calls `predict_proba`.

---

# Milestone 9 — Model registry and inference

## Goal

Run real model inference inside FastAPI.

## Models

Add:

- ModelVersion
- FeatureSnapshot
- RiskPrediction

Create migration.

## Startup

`model_loader.py` loads:

```env
MODEL_BUNDLE_PATH
```

Validate:

- file exists;
- `model`;
- `feature_names`;
- `thresholds`;
- model supports `predict_proba`.

If the model cannot load, `/ready` should fail while `/health` may still return process health.

## Implement service

```python
prediction_service.predict_student(...)
```

Flow:

```text
authorize
get history
build features
reindex to feature_names
predict_proba
apply thresholds
persist feature snapshot
persist prediction
return result
```

## Endpoints

```text
POST /api/v1/teacher/students/{student_id}/predictions
GET  /api/v1/teacher/students/{student_id}/predictions
POST /api/v1/teacher/classes/{course_id}/predictions
```

For class batch prediction, keep it synchronous initially if the class size is modest.

## Acceptance criteria

A prediction row references:

- student;
- model version;
- feature snapshot;
- timestamp.

The exact feature set used can be reconstructed later.

---

# Milestone 10 — Explanation engine

## Goal

Never show teachers only a probability.

## Create

```text
app/services/explanation_service.py
app/ml/explanations.py
```

## First implementation

Use deterministic feature-driven explanations.

Examples:

```python
if attendance_change_4wk <= -8:
    ...
if score_change_4wk <= -10:
    ...
if late_submission_streak >= 2:
    ...
if participation_rate is low:
    ...
if days_since_last_login is high:
    ...
```

Normalize severity.

Return max 3-5 meaningful signals.

## Requirements

An explanation must name an actual measurable change.

Good:

```text
Attendance decreased by 9.2 percentage points over the last four weeks.
```

Bad:

```text
AI thinks the student lacks motivation.
```

Do not infer motivation, mental health, or family circumstances.

## Acceptance criteria

The same features produce deterministic explanations.

---

# Milestone 11 — Recommendation engine

## Goal

Map the student's current flagged factors to useful actions.

## Create

```text
InterventionTemplate
app/ml/recommendations.py
app/services/recommendation_service.py
```

Seed default templates:

```text
Morning attendance check-in
One-on-one subject review
Peer tutoring
Assignment planner
Study group
Deadline reminder plan
Study timetable review
```

Keep counselor/support-service referral available only as a school-configurable template, not an automatic medical interpretation.

## Algorithm

Start with v2 plan:

- convert student factor severity to a vector;
- convert resource tags to a vector;
- cosine similarity;
- return top N.

Alternatively, a deterministic weighted dot product is acceptable if simpler and tested.

## Acceptance criteria

Different factor combinations can produce different recommendation ordering.

Recommendations are returned but not automatically created as interventions.

---

# Milestone 12 — Intervention tracking

## Goal

Turn prediction into a teacher-managed support workflow.

## Models

Add:

- Intervention
- InterventionUpdate

## Endpoints

```text
POST  /api/v1/teacher/students/{student_id}/interventions
GET   /api/v1/teacher/students/{student_id}/interventions
GET   /api/v1/teacher/interventions/{id}
PATCH /api/v1/teacher/interventions/{id}
POST  /api/v1/teacher/interventions/{id}/updates
POST  /api/v1/teacher/interventions/{id}/complete
```

## Intervention create example

```json
{
  "template_id": "...",
  "prediction_id": "...",
  "title": "Weekly Mathematics Review",
  "start_date": "2026-10-05",
  "review_date": "2026-10-19",
  "visibility_to_student": true,
  "goal_definition": {
    "assessment_avg_score_target": 70,
    "attendance_target": 90
  }
}
```

## Acceptance criteria

A teacher can:

1. view prediction;
2. select recommendation;
3. create intervention;
4. add follow-up note;
5. complete intervention;
6. compare subsequent student metrics.

---

# Milestone 13 — Teacher dashboard aggregation API

## Goal

Return all information the React teacher dashboard needs without excessive requests.

## Endpoint

```text
GET /api/v1/teacher/classes/{course_id}/risk-summary
```

Example:

```json
{
  "course": {...},
  "counts": {
    "students": 38,
    "priority_support": 5,
    "watch": 9,
    "doing_well": 24,
    "newly_declining": 3
  },
  "students": [
    {
      "student_id": "...",
      "name": "...",
      "roll_number": "...",
      "support_level": "priority_support",
      "trajectory": "declining",
      "latest_score": 61,
      "attendance": 78,
      "top_signal": "Attendance decreased over four weeks.",
      "active_intervention": true
    }
  ]
}
```

## Ordering

Allow:

```text
?sort=attention
?sort=name
?sort=attendance
?sort=score
```

Default can be `attention`.

Do not turn sorting into an irreversible decision rule.

---

# Milestone 14 — Student progress API

## Goal

Students see progress, not an alarming internal ML score.

## Endpoints

```text
GET /api/v1/student/me/dashboard
GET /api/v1/student/me/progress
GET /api/v1/student/me/interventions
```

Return:

- attendance trend;
- academic trend;
- assignment completion;
- on-time streak;
- personal improvements;
- visible teacher actions/goals.

Do not return:

```text
risk_probability
at_risk
private teacher notes
internal severity values
```

## Tests

Explicitly assert those keys are missing from student API responses.

---

# Milestone 15 — CSV import

## Goal

Allow school setup and bulk weekly data entry.

## Implement

```text
POST /api/v1/admin/imports/students
POST /api/v1/admin/imports/weekly-records
GET  /api/v1/admin/imports/{id}
```

## Import behavior

Use staged validation.

Response should identify:

```text
row number
field
error code
human-readable message
```

Do not partially import without making the result explicit.

A reasonable MVP strategy:

- validate all rows first;
- if validation errors exist, return preview/errors and import none;
- later add partial import mode.

---

# Milestone 16 — Student check-in / sentiment experiment

## Goal

Add the v2 text signal without mixing it directly into the rest of the backend.

## Important

This is not required for the first backend MVP.

Create a separate classifier/module.

Input:

```text
Weekly_Feedback / student_checkin_text
```

Output example:

```text
positive
neutral
negative
```

or a numeric check-in signal.

Do not claim that this detects:

- depression;
- anxiety;
- emotional disorder;
- mental-health condition.

Product wording:

```text
student check-in signal
```

The teacher should see the original student-submitted message according to school access policy, not a medical conclusion.

---

# Milestone 17 — v2 model upgrade

## Goal

Move beyond the baseline notebook.

## Implement after the end-to-end system works

Use the v2 model plan.

### Temporal features

Use 4-8 weeks.

### Validation

Add:

- stratified cross-validation for non-temporal baseline comparison;
- time-aware validation for realistic longitudinal evaluation.

### Candidate stacked ensemble

Example:

```text
Random Forest
Gradient Boosting
        |
Logistic Regression meta-model
```

Do not deploy a more complex model only because it is more complex.

Compare:

- recall;
- precision;
- F1;
- ROC-AUC;
- calibration;
- false negatives.

Store evaluation metrics in `model_versions.metrics`.

---

# Milestone 18 — Optional Google Calendar integration

## Goal

Let a teacher schedule an intervention session.

Do this only after intervention tracking works.

## Flow

```text
create intervention
    ->
schedule local session
    ->
optional Google Calendar OAuth
    ->
create calendar event
    ->
save provider event id
```

If calendar creation fails:

- keep intervention;
- return integration error;
- allow retry.

Do not make Google Calendar the system of record.

---

# Milestone 19 — Hardening

## Security

Add:

- rate limiting for login;
- password reset flow;
- stricter CORS;
- secure production cookie/token decisions;
- secrets management;
- database backups;
- audit review.

## Performance

Add indexes for:

```text
school_id
student_id
course_offering_id
week_start
created_at
```

Composite indexes should support:

```text
student + course + week
teacher-course lookup
latest prediction per student
```

## Pagination

Add pagination to list routes.

## Concurrency

Prevent duplicate predictions/interventions where appropriate using transactions/constraints.

---

# Milestone 20 — Final backend acceptance test

Create one end-to-end automated test covering:

```text
1. create School A
2. create admin
3. admin logs in
4. create teacher
5. create student
6. create class
7. create subject
8. create course offering
9. assign teacher
10. enroll student
11. teacher logs in
12. teacher submits 8 weekly records
13. teacher runs prediction
14. prediction stores feature snapshot
15. teacher receives explanation
16. teacher receives recommendations
17. teacher creates intervention
18. student logs in
19. student sees progress + visible intervention
20. student cannot see raw risk probability
21. another school's teacher cannot access the student
```

The backend is not considered finished until this test passes.

---

# API implementation checklist

Use this checklist during development.

## Infrastructure

- [ ] FastAPI starts
- [ ] PostgreSQL starts
- [ ] Alembic configured
- [ ] `/health`
- [ ] `/ready`
- [ ] Docker Compose
- [ ] `.env.example`
- [ ] Swagger docs

## Auth

- [ ] Argon2
- [ ] Access JWT
- [ ] Refresh token
- [ ] Logout/revoke
- [ ] RBAC dependencies

## School data

- [ ] School
- [ ] User
- [ ] TeacherProfile
- [ ] StudentProfile
- [ ] Classroom
- [ ] Subject
- [ ] CourseOffering
- [ ] Teacher assignment
- [ ] Enrollment

## Academic history

- [ ] WeeklyRecord
- [ ] field validation
- [ ] batch endpoint
- [ ] audit changes

## ML

- [ ] feature builder
- [ ] feature version
- [ ] notebook converted to training script
- [ ] model bundle
- [ ] startup model loader
- [ ] model registry
- [ ] feature snapshot
- [ ] prediction persistence
- [ ] threshold mapping

## Intelligence layer

- [ ] explanation engine
- [ ] intervention catalog
- [ ] recommendation engine

## Intervention system

- [ ] create
- [ ] update
- [ ] follow-up
- [ ] complete
- [ ] student visibility
- [ ] outcome tracking

## Product APIs

- [ ] teacher class summary
- [ ] teacher student progress
- [ ] student dashboard
- [ ] student progress
- [ ] student interventions

## Import

- [ ] student CSV
- [ ] weekly-record CSV
- [ ] validation report
- [ ] ImportJob

## Quality

- [ ] tenant isolation tests
- [ ] teacher-assignment tests
- [ ] feature math tests
- [ ] prediction tests
- [ ] student privacy tests
- [ ] end-to-end test

---

# Recommended implementation sequence

Do not change this sequence unless repository constraints require it.

```text
1  bootstrap
2  database
3  auth/RBAC
4  admin APIs
5  teacher authorization
6  weekly data
7  feature engineering
8  training script
9  model inference
10 explanations
11 recommendations
12 interventions
13 teacher dashboard APIs
14 student APIs
15 CSV import
16 sentiment experiment
17 v2 ensemble
18 calendar
19 hardening
20 end-to-end verification
```

This sequence intentionally gets a complete useful product working before adding experimental ML complexity.

---

# Coding conventions

## Services

Route files should stay thin.

Bad:

```python
@router.post(...)
def endpoint(...):
    # 150 lines of DB + ML logic
```

Preferred:

```python
@router.post(...)
def endpoint(...):
    return prediction_service.predict_student(...)
```

## Transactions

Use transactions for operations such as:

```text
feature snapshot + prediction
intervention + initial update
bulk enrollment
```

## Schemas

Do not return raw ORM objects without explicit response schemas.

## Dates

Use ISO-8601.

`week_start` should be a `date`.

Timestamps should be UTC.

## IDs

Use UUID.

## Enums

Keep role/status values centrally defined.

## Type checking

Add type hints to service/module public interfaces.

---

# Do not do these things

- Do not create a single `students` table containing every current and future ML feature.
- Do not accept a 40-feature prediction form from teachers.
- Do not put name, phone, address, roll number, or school name into the model.
- Do not train against `Risk_Score` or `Risk_Level`.
- Do not expose the student's raw risk score in the student dashboard.
- Do not automatically execute recommendations.
- Do not make calendar integration mandatory.
- Do not create a microservice for every module.
- Do not add LLM calls to the prediction path.
- Do not make a teacher manually create every student.
- Do not use a random train/test split as the only long-term validation result.
- Do not silently ignore CSV import failures.
- Do not use future weekly data when recreating a historical prediction.

---

# First Codex execution target

For the first execution, complete only Milestones 1-3:

```text
1. FastAPI/Postgres bootstrap
2. core school data model
3. authentication + RBAC
```

Then run:

```bash
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api pytest
docker compose exec api ruff check .
```

Document:

- startup command;
- seeded accounts;
- implemented endpoints;
- test result;
- migration revision.

Only after Milestones 1-3 are stable should Codex proceed to Milestone 4.

This avoids generating an untestable backend in one large pass.
