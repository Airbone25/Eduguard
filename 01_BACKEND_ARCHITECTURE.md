# EduGuard Backend Architecture

> Codex handoff document  
> Scope: backend-first implementation for the EduGuard school early-support platform  
> Frontend is intentionally out of scope for this phase.

## 1. Product goal

EduGuard is a multi-school early-support platform.

It should help schools:

1. organize administrators, teachers, students, classes, subjects, and enrollments;
2. collect normal academic/engagement information teachers or school systems already have;
3. derive ML features automatically from longitudinal student history;
4. calculate a student support/risk signal;
5. explain the main signals behind that result;
6. recommend possible teacher interventions;
7. let the teacher choose and track an intervention;
8. show students progress-oriented metrics, goals, and improvement trends.

The ML prediction is **advisory**. It must never automatically make a disciplinary, academic, or counseling decision.

---

## 2. Source material this architecture is based on

Use these project files as the baseline when implementing:

- `EduGuard_AI_Risk_Detection_Colab.ipynb`
- `student_dataset_enriched.csv`
- `eduguard-ai-v2-model-plan.md`

The current dataset contains 9,000 rows and 52 columns.

The current notebook:

- predicts `At_Risk`;
- excludes identity/PII, target-derived fields, free text, grade, and school name from the numeric model;
- compares Logistic Regression, Random Forest, and Gradient Boosting;
- saves a scikit-learn model with `joblib`;
- maps risk probability to:
  - Low: `< 0.40`
  - Medium: `0.40 <= p < 0.65`
  - High: `>= 0.65`

Treat those thresholds as **baseline configuration**, not permanent product truth.

The v2 plan adds:

- richer behavioral signals;
- temporal features;
- cross-validation;
- a stacked ensemble;
- a recommendation engine;
- weekly history rather than one-time snapshot prediction.

---

## 3. Architecture decisions

### 3.1 Backend stack

Use:

- Python 3.12+
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x
- PostgreSQL
- Alembic
- PyJWT or python-jose for JWT
- Argon2 password hashing
- pandas
- numpy
- scikit-learn
- joblib
- pytest
- httpx for API tests
- Ruff
- mypy where practical
- Docker / Docker Compose

Optional later:

- Redis
- Celery/RQ/Arq
- S3-compatible object storage
- Google Calendar
- email provider

Do **not** require Redis or Celery for the first working backend.

### 3.2 Database choice

Use PostgreSQL instead of MongoDB.

Reason: the application is strongly relational:

- one school has many users;
- teachers belong to classes/course offerings;
- students have many enrollments;
- students have weekly records;
- predictions belong to students and model versions;
- interventions belong to students and teachers.

PostgreSQL makes relational integrity, authorization, reporting, joins, and audit history easier.

### 3.3 Multi-tenancy

EduGuard is a multi-school application.

Every school-owned row must be scoped by `school_id` either directly or through a relationship that can be safely resolved.

Never trust a `school_id` sent by a normal teacher/student client.

The authenticated user determines the current tenant.

For the MVP, use shared tables with `school_id`.

Possible future upgrade:

- PostgreSQL Row Level Security.

### 3.4 Raw data vs derived data

Teachers and administrators should enter or upload only data they naturally know.

Examples of raw/input data:

- classes held;
- classes attended;
- marks/assessment results;
- assignment counts;
- late submissions;
- quiz results;
- LMS activity if available;
- participation;
- optional student check-in/confidence data.

The backend computes derived values.

Examples:

- attendance percentage;
- average score;
- score standard deviation;
- rolling averages;
- 4-week change;
- slope;
- volatility;
- late-submission streak;
- engagement score;
- consistency score.

Never require a teacher to manually enter generated ML features.

### 3.5 Longitudinal design

EduGuard should operate on weekly history.

A prediction should be based on:

`student history up to prediction date`

not only:

`one current row`

The system should preserve historical weekly records rather than overwriting them.

### 3.6 Prediction output

Internally, the model may return:

```json
{
  "risk_probability": 0.72,
  "risk_level": "high",
  "at_risk": true
}
```

Teacher-facing product language should preferably map this to support terminology:

| Internal | Teacher UI |
|---|---|
| low | Doing Well |
| medium | Watch |
| high | Support Recommended / Priority Support |

The student should not receive raw risk probability by default.

### 3.7 Human decision ownership

The system may suggest:

- one-on-one session;
- peer tutoring;
- attendance check-in;
- assignment planner;
- study plan;
- study group;
- parent/guardian follow-up;
- counselor/support-service referral where the school considers it appropriate.

The teacher decides whether to create an intervention.

---

# 4. High-level system

```text
React Client (later)
        |
        v
+--------------------------+
|         FastAPI          |
|--------------------------|
| Authentication / RBAC    |
| School / Class APIs      |
| Weekly Record APIs       |
| Student Progress APIs    |
| Prediction API           |
| Explanation Service      |
| Recommendation Service   |
| Intervention APIs        |
| Import APIs              |
+------------+-------------+
             |
     +-------+--------+
     |                |
     v                v
PostgreSQL      ML Service Layer
                     |
             Feature Engineering
                     |
               Model Bundle
                     |
             Recommendation Rules
```

The ML service is an internal Python service/module inside the FastAPI project for MVP.

Do not create a separate ML microservice yet.

---

# 5. Suggested repository structure

Create the backend under `backend/`.

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── router.py
│   │       ├── auth.py
│   │       ├── admin.py
│   │       ├── schools.py
│   │       ├── classes.py
│   │       ├── courses.py
│   │       ├── students.py
│   │       ├── teachers.py
│   │       ├── weekly_records.py
│   │       ├── predictions.py
│   │       ├── interventions.py
│   │       ├── imports.py
│   │       └── health.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── permissions.py
│   │   ├── logging.py
│   │   └── exceptions.py
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py
│   │   └── seed.py
│   ├── models/
│   │   ├── school.py
│   │   ├── user.py
│   │   ├── classroom.py
│   │   ├── subject.py
│   │   ├── course.py
│   │   ├── enrollment.py
│   │   ├── weekly_record.py
│   │   ├── feature_snapshot.py
│   │   ├── prediction.py
│   │   ├── intervention.py
│   │   ├── import_job.py
│   │   └── audit_log.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── school.py
│   │   ├── user.py
│   │   ├── classroom.py
│   │   ├── course.py
│   │   ├── weekly_record.py
│   │   ├── prediction.py
│   │   ├── intervention.py
│   │   └── import_job.py
│   ├── repositories/
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── school_service.py
│   │   ├── enrollment_service.py
│   │   ├── weekly_record_service.py
│   │   ├── feature_service.py
│   │   ├── prediction_service.py
│   │   ├── explanation_service.py
│   │   ├── recommendation_service.py
│   │   ├── intervention_service.py
│   │   ├── import_service.py
│   │   └── audit_service.py
│   └── ml/
│       ├── feature_definitions.py
│       ├── feature_builder.py
│       ├── model_loader.py
│       ├── inference.py
│       ├── explanations.py
│       ├── recommendations.py
│       └── training.py
├── artifacts/
│   └── .gitkeep
├── alembic/
├── scripts/
│   ├── train_model.py
│   ├── seed_demo.py
│   └── create_admin.py
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_permissions.py
│   ├── test_admin.py
│   ├── test_weekly_records.py
│   ├── test_features.py
│   ├── test_predictions.py
│   ├── test_interventions.py
│   └── test_student_dashboard.py
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── .env.example
└── README.md
```

---

# 6. Roles and permissions

Use these initial roles:

```python
SCHOOL_ADMIN = "school_admin"
TEACHER = "teacher"
STUDENT = "student"
```

Optional later:

```python
COUNSELOR = "counselor"
SUPER_ADMIN = "super_admin"
```

## Permission matrix

| Action | Admin | Teacher | Student |
|---|---:|---:|---:|
| Manage school profile | Yes | No | No |
| Create teachers | Yes | No | No |
| Create students | Yes | No | No |
| Create classes | Yes | No | No |
| Assign teachers | Yes | No | No |
| Enroll students | Yes | No | No |
| View assigned students | Yes | Yes | Self only |
| Enter weekly academic data | Optional | Yes | No |
| Run/view predictions | Yes | Assigned students | No raw risk |
| Create intervention | Yes | Assigned students | No |
| View intervention | Yes | Assigned students | Own visible actions |
| View progress dashboard | Yes | Assigned students | Self |
| Import CSV | Yes | Optional restricted | No |
| View audit log | Yes | No | No |

Teacher authorization must verify that the teacher is assigned to the student's course/class.

Do not authorize based only on `school_id`.

---

# 7. Database model

Use UUID primary keys unless there is a strong reason not to.

All timestamps should be timezone-aware UTC.

## 7.1 schools

```text
id UUID PK
name VARCHAR
slug VARCHAR UNIQUE
domain VARCHAR NULL
is_active BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

`slug` can support:

```text
/s/greenwood
```

Later the same school can be mapped to:

```text
greenwood.eduguard.app
```

Do not make custom-domain routing a prerequisite for MVP.

## 7.2 users

```text
id UUID PK
school_id UUID FK -> schools
email CITEXT
password_hash VARCHAR
role ENUM/VARCHAR
first_name VARCHAR
last_name VARCHAR
is_active BOOLEAN
last_login_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ

UNIQUE(school_id, email)
```

Do not use roll number as the password.

Students may log in using:

- email + password, or
- school slug + roll number + password if required later.

The canonical identity should still be the `user`.

## 7.3 teacher_profiles

```text
id UUID PK
school_id UUID FK
user_id UUID FK UNIQUE
employee_code VARCHAR NULL
phone VARCHAR NULL
created_at
updated_at
```

## 7.4 student_profiles

```text
id UUID PK
school_id UUID FK
user_id UUID FK UNIQUE
roll_number VARCHAR
grade_label VARCHAR
phone VARCHAR NULL
address TEXT NULL
guardian_name VARCHAR NULL
guardian_contact VARCHAR NULL
created_at
updated_at

UNIQUE(school_id, roll_number)
```

PII fields are not ML features.

## 7.5 classrooms

Represents a school group such as `Grade 10 - A`.

```text
id UUID PK
school_id UUID FK
name VARCHAR
grade_label VARCHAR
academic_year VARCHAR
is_active BOOLEAN
created_at
updated_at
```

## 7.6 subjects

```text
id UUID PK
school_id UUID FK
code VARCHAR
name VARCHAR
created_at
updated_at

UNIQUE(school_id, code)
```

Examples:

- MATH
- PHY
- CHEM

Do not hardcode Math/Physics/Chemistry into the schema.

## 7.7 course_offerings

Represents:

`Grade 10-A + Mathematics + 2026`

```text
id UUID PK
school_id UUID FK
classroom_id UUID FK
subject_id UUID FK
academic_year VARCHAR
is_active BOOLEAN
created_at
updated_at
```

## 7.8 course_teachers

Many-to-many assignment.

```text
course_offering_id UUID FK
teacher_id UUID FK -> teacher_profiles
school_id UUID FK
is_primary BOOLEAN
created_at

PRIMARY KEY(course_offering_id, teacher_id)
```

## 7.9 enrollments

```text
id UUID PK
school_id UUID FK
student_id UUID FK -> student_profiles
course_offering_id UUID FK
status VARCHAR
enrolled_at DATE
created_at
updated_at

UNIQUE(student_id, course_offering_id)
```

## 7.10 weekly_records

This is the core longitudinal input table for MVP.

One row represents one student's weekly metrics in one course offering.

```text
id UUID PK
school_id UUID FK
student_id UUID FK
course_offering_id UUID FK
week_start DATE

classes_held INT NULL
classes_attended INT NULL

study_hours_weekly NUMERIC NULL

assessment_avg_score NUMERIC NULL
assessment_count INT NULL

assignment_count INT NULL
late_submissions INT NULL
last_minute_submissions INT NULL
avg_submission_delay_days NUMERIC NULL
assignment_avg_score NUMERIC NULL

quiz_count INT NULL
quiz_attempt_count INT NULL
quiz_avg_score NUMERIC NULL

lms_login_count INT NULL
lms_active_days INT NULL
avg_lms_session_min NUMERIC NULL
total_lms_time_min NUMERIC NULL
days_since_last_login INT NULL

participation_count INT NULL
participation_opportunities INT NULL

student_confidence_score INT NULL
student_checkin_text TEXT NULL

source VARCHAR
created_by UUID FK -> users
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ

UNIQUE(student_id, course_offering_id, week_start)
```

`source` values may include:

```text
manual
csv_import
lms_sync
sis_sync
```

Input validation examples:

- percentages/scores: `0..100`;
- counts: `>= 0`;
- `classes_attended <= classes_held`;
- `late_submissions <= assignment_count`;
- confidence: `1..5`.

## 7.11 feature_snapshots

Stores reproducible features used for a prediction.

```text
id UUID PK
school_id UUID FK
student_id UUID FK
course_offering_id UUID FK NULL
as_of_date DATE
feature_version VARCHAR
features JSONB
created_at TIMESTAMPTZ
```

Do not place every future feature in database columns.

`JSONB` here is appropriate because model feature sets can change by version.

## 7.12 model_versions

```text
id UUID PK
name VARCHAR
version VARCHAR
artifact_path VARCHAR
feature_version VARCHAR
metrics JSONB
thresholds JSONB
is_active BOOLEAN
trained_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

Only one model version should be active per prediction task unless explicitly selected.

## 7.13 risk_predictions

```text
id UUID PK
school_id UUID FK
student_id UUID FK
course_offering_id UUID FK NULL
feature_snapshot_id UUID FK
model_version_id UUID FK
risk_probability NUMERIC
risk_level VARCHAR
at_risk BOOLEAN
explanations JSONB
created_at TIMESTAMPTZ
created_by UUID FK NULL
```

Example `explanations`:

```json
[
  {
    "factor": "attendance_trend",
    "direction": "down",
    "message": "Attendance decreased over the last four weeks.",
    "severity": 0.81
  },
  {
    "factor": "late_submission_streak",
    "direction": "up",
    "message": "Late submissions occurred for three consecutive weeks.",
    "severity": 0.66
  }
]
```

Never claim causal certainty.

Use language such as:

- "signal";
- "associated factor";
- "recent change";
- "contributing model feature".

Do not say:

- "this caused the student to fail."

## 7.14 intervention_templates

School-configurable catalog.

```text
id UUID PK
school_id UUID FK NULL
name VARCHAR
description TEXT
tags JSONB
default_duration_days INT NULL
is_active BOOLEAN
created_at
updated_at
```

`school_id = NULL` may represent system defaults.

Possible tags:

```json
{
  "attendance": 1.0,
  "late_submissions": 0.5,
  "avg_score": 0.2
}
```

## 7.15 interventions

```text
id UUID PK
school_id UUID FK
student_id UUID FK
course_offering_id UUID FK NULL
prediction_id UUID FK NULL
template_id UUID FK NULL
assigned_by UUID FK -> users

title VARCHAR
description TEXT NULL
status VARCHAR
start_date DATE
review_date DATE NULL
end_date DATE NULL

goal_definition JSONB NULL
visibility_to_student BOOLEAN DEFAULT TRUE

calendar_provider VARCHAR NULL
calendar_event_id VARCHAR NULL

created_at
updated_at
```

Statuses:

```text
planned
active
completed
cancelled
```

## 7.16 intervention_updates

```text
id UUID PK
school_id UUID FK
intervention_id UUID FK
author_user_id UUID FK
note TEXT NULL
outcome_metrics JSONB NULL
created_at
```

This allows EduGuard to answer:

`Did the student's indicators improve after the intervention?`

## 7.17 import_jobs

```text
id UUID PK
school_id UUID FK
uploaded_by UUID FK
filename VARCHAR
import_type VARCHAR
status VARCHAR
rows_total INT
rows_succeeded INT
rows_failed INT
errors JSONB
created_at
completed_at NULL
```

## 7.18 audit_logs

```text
id UUID PK
school_id UUID FK
actor_user_id UUID FK NULL
action VARCHAR
entity_type VARCHAR
entity_id UUID NULL
metadata JSONB
created_at
```

Never put passwords, JWTs, or complete student check-in text in audit metadata.

---

# 8. Feature engineering

## 8.1 Current dataset mapping

The uploaded enriched dataset contains both raw and derived columns.

### Identity/metadata columns

Keep outside the numeric ML model:

- Student_Names
- Phone_No.
- Student Address
- Roll No.
- Grade
- School Name

### Text fields

Keep separate from the numeric model unless handled by a dedicated text pipeline:

- Comment
- Weekly_Feedback

### Current target / target-derived fields

Never use as prediction inputs:

- At_Risk
- Risk_Level
- Risk_Score

### Sentiment

The current dataset includes:

- Sentiment_Score
- Sentiment_Label

For v2:

- the raw weekly reflection/check-in text should be stored separately;
- a separate text classifier may create a check-in/sentiment feature;
- do not present that score as a mental-health diagnosis.

## 8.2 Derived features

The feature service should calculate values such as:

```text
attendance_percent
avg_score
score_std
on_time_submissions
last_minute_submission_rate
quiz_score_volatility
participation_rate

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

Only calculate a feature when there is enough source data.

If history is too short:

- return `None` / `NaN`;
- let the sklearn pipeline impute;
- include `history_weeks_available` as metadata.

Do not fabricate history.

## 8.3 Feature versions

Every generated feature snapshot needs:

```text
feature_version
```

Example:

```text
v1_baseline_40
v2_temporal_2026_01
```

Changing the feature calculation requires a new version.

---

# 9. ML architecture

## 9.1 Separate training from inference

FastAPI should not retrain the model during normal requests.

Use:

```text
scripts/train_model.py
```

to train and write an artifact.

FastAPI:

1. loads the active artifact on startup;
2. validates its expected feature list;
3. runs inference only.

## 9.2 Model bundle

Prefer saving a dictionary/object similar to:

```python
{
    "model": fitted_pipeline,
    "model_name": "logistic_regression",
    "model_version": "baseline-001",
    "feature_version": "v1_baseline_40",
    "feature_names": [...],
    "thresholds": {
        "medium": 0.40,
        "high": 0.65,
        "at_risk": 0.50
    },
    "metrics": {...}
}
```

Save with joblib:

```text
artifacts/eduguard_model_bundle.joblib
```

Do not rely on implicit DataFrame column order.

## 9.3 Baseline training

First reproduce the uploaded notebook as a script.

Models:

- Logistic Regression;
- Random Forest;
- Gradient Boosting.

The script should:

- load CSV;
- remove excluded fields;
- split data;
- train models;
- calculate:
  - precision;
  - recall;
  - F1;
  - ROC-AUC;
  - confusion matrix;
- choose the configured selection metric;
- save a model bundle.

Then create a second v2 training path with:

- temporal features;
- 5-fold validation where appropriate;
- eventually a stacked ensemble.

## 9.4 Important validation upgrade

For a longitudinal production-like evaluation, prefer a time-aware strategy.

Example:

```text
weeks 1-12 -> train
weeks 13-16 -> validation
weeks 17-20 -> test
```

Random train/test splitting is acceptable only for reproducing the current baseline.

## 9.5 Inference service contract

Internal function:

```python
predict_student(
    student_id: UUID,
    as_of_date: date,
    course_offering_id: UUID | None = None,
) -> PredictionResult
```

Process:

```text
load student history
    ->
build raw aggregate
    ->
build temporal features
    ->
reindex exactly to model feature_names
    ->
model.predict_proba()
    ->
map threshold
    ->
generate explanations
    ->
generate recommendations
    ->
persist feature snapshot
    ->
persist prediction
```

---

# 10. Explanation engine

Do not depend on SHAP for MVP.

Start with transparent factor rules over normalized feature values and trends.

Examples:

```text
attendance_change_4wk < -8
late_submission_streak >= 2
score_change_4wk < -10
days_since_last_login > threshold
quiz_score_volatility high
participation_rate declining
```

Return the top 3 useful teacher-readable signals.

Example:

```json
{
  "support_level": "priority_support",
  "signals": [
    "Attendance decreased by 9.4 percentage points over four weeks.",
    "Three assignments were submitted late consecutively.",
    "Average assessment score decreased by 11.2 points."
  ]
}
```

An explanation must be based on actual current feature values.

Do not generate invented explanations from the final probability.

---

# 11. Recommendation engine

Start with the v2 resource-catalog design.

Input:

```python
{
    "attendance": 0.8,
    "avg_score": 0.7,
    "late_submissions": 0.4,
    "study_hours": 0.2
}
```

Possible output:

```json
[
  {
    "template_id": "...",
    "name": "Morning attendance check-in",
    "match_score": 0.86,
    "reason": "Matches the student's attendance trend."
  },
  {
    "template_id": "...",
    "name": "One-on-one subject review",
    "match_score": 0.72,
    "reason": "Matches the recent score decline."
  }
]
```

Important:

- recommender output is not automatically actioned;
- the teacher must choose;
- schools can disable templates;
- the catalog must be editable.

---

# 12. API design

Base path:

```text
/api/v1
```

## 12.1 Auth

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
POST /auth/change-password
```

Login response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "role": "teacher",
    "school_id": "..."
  }
}
```

Access token should be short-lived.

Refresh tokens should be revocable. Store only a token hash / identifier, not the plaintext token.

## 12.2 Admin

```text
GET    /admin/users
POST   /admin/teachers
POST   /admin/students
PATCH  /admin/users/{user_id}
POST   /admin/classes
POST   /admin/subjects
POST   /admin/course-offerings
POST   /admin/course-offerings/{course_id}/teachers
POST   /admin/course-offerings/{course_id}/students
GET    /admin/imports
POST   /admin/imports/students
POST   /admin/imports/weekly-records
```

## 12.3 Teacher

```text
GET /teacher/classes
GET /teacher/classes/{course_id}/students
GET /teacher/students/{student_id}
GET /teacher/students/{student_id}/progress
GET /teacher/students/{student_id}/predictions
GET /teacher/students/{student_id}/interventions
```

## 12.4 Weekly records

```text
PUT  /teacher/students/{student_id}/weekly-records/{week_start}
POST /teacher/weekly-records/batch
GET  /teacher/students/{student_id}/weekly-records
```

Use upsert behavior for the same:

```text
student + course + week_start
```

but create an audit record when data changes.

## 12.5 Predictions

```text
POST /teacher/students/{student_id}/predictions
POST /teacher/classes/{course_id}/predictions
GET  /teacher/classes/{course_id}/risk-summary
```

Single prediction response:

```json
{
  "student_id": "...",
  "as_of_date": "2026-10-01",
  "model_version": "baseline-001",
  "feature_version": "v1-baseline",
  "risk_probability": 0.72,
  "risk_level": "high",
  "support_level": "priority_support",
  "signals": [
    {
      "code": "attendance_decline",
      "message": "Attendance decreased over the last four weeks."
    }
  ],
  "recommendations": [
    {
      "template_id": "...",
      "name": "Morning attendance check-in"
    }
  ]
}
```

## 12.6 Interventions

```text
POST   /teacher/students/{student_id}/interventions
GET    /teacher/students/{student_id}/interventions
GET    /teacher/interventions/{intervention_id}
PATCH  /teacher/interventions/{intervention_id}
POST   /teacher/interventions/{intervention_id}/updates
POST   /teacher/interventions/{intervention_id}/complete
```

## 12.7 Student

```text
GET /student/me/dashboard
GET /student/me/progress
GET /student/me/interventions
GET /student/me/goals
```

Do not return:

```text
risk_probability
at_risk
internal model explanations
private teacher notes
```

unless the product explicitly changes that policy.

Student dashboard should return progress concepts:

```json
{
  "attendance": {
    "current": 91.0,
    "change_4wk": 3.0,
    "trend": "improving"
  },
  "academic": {
    "current_average": 74.0,
    "change_4wk": 6.0,
    "trend": "improving"
  },
  "assignments": {
    "completed": 8,
    "total": 9
  },
  "goals": [...],
  "visible_interventions": [...]
}
```

## 12.8 Health

```text
GET /health
GET /ready
```

`/ready` should verify:

- database connection;
- model bundle successfully loaded.

---

# 13. Authentication and security

## Passwords

Use Argon2.

Never store plaintext passwords.

## JWT

JWT should include minimum claims:

```json
{
  "sub": "user_uuid",
  "school_id": "school_uuid",
  "role": "teacher",
  "type": "access"
}
```

Never trust role or school values from request body.

## Authorization

Implement reusable dependencies:

```python
get_current_user()
require_role(...)
require_school_admin()
require_teacher()
require_student()
require_teacher_student_access(student_id)
require_teacher_course_access(course_id)
```

Every teacher/student data endpoint must call an authorization dependency.

## PII

Do not send these fields to the ML inference DataFrame:

- name;
- email;
- phone;
- address;
- guardian contact;
- school name;
- roll number.

Do not log:

- passwords;
- auth tokens;
- full free-text check-ins.

---

# 14. CSV import design

CSV import is an onboarding/bulk-entry tool, not the core application architecture.

## Student import

Suggested template:

```csv
email,first_name,last_name,roll_number,grade,class_name
```

## Weekly record import

Suggested normalized template:

```csv
roll_number,subject_code,week_start,classes_held,classes_attended,study_hours_weekly,assessment_avg_score,assignment_count,late_submissions,assignment_avg_score,quiz_avg_score,lms_login_count,participation_count
```

Import flow:

1. upload;
2. parse headers;
3. validate;
4. preview validation errors;
5. persist valid rows;
6. store failed-row details in `import_jobs`;
7. never silently drop invalid rows.

---

# 15. Calendar integration

Calendar is optional and comes after the intervention system works.

Flow:

```text
Teacher creates intervention
        |
Teacher clicks schedule session
        |
EduGuard stores intervention schedule
        |
Optional Google Calendar event is created
        |
calendar_event_id stored on intervention
```

EduGuard's own database remains the source of truth.

Calendar failure must not delete the intervention.

---

# 16. Student progress and gamification

The backend may calculate positive progress events.

Examples:

```text
attendance_improvement
assignment_streak
score_improvement
on_time_submission_streak
personal_best
goal_completed
```

Do not rank students publicly against each other in MVP.

Use self-comparison:

```text
this week vs previous weeks
current score vs own baseline
current attendance vs own baseline
```

---

# 17. Auditability

Create audit entries for:

- user creation;
- enrollment changes;
- teacher assignment;
- weekly record creation/edit;
- prediction execution;
- intervention creation/status change;
- import execution.

Prediction records must preserve:

- model version;
- feature version;
- exact feature snapshot;
- time generated.

This allows a later reviewer to reproduce what the system knew at that moment.

---

# 18. Error format

Use one consistent error shape.

```json
{
  "error": {
    "code": "TEACHER_STUDENT_ACCESS_DENIED",
    "message": "You do not have access to this student.",
    "details": null
  }
}
```

Do not expose stack traces in production.

---

# 19. Configuration

Create `.env.example`.

Suggested values:

```env
APP_NAME=EduGuard API
ENVIRONMENT=development
API_V1_PREFIX=/api/v1

DATABASE_URL=postgresql+psycopg://eduguard:eduguard@db:5432/eduguard

JWT_SECRET=change-me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=14

MODEL_BUNDLE_PATH=artifacts/eduguard_model_bundle.joblib

CORS_ORIGINS=http://localhost:5173

LOG_LEVEL=INFO
```

Never commit the real `.env`.

---

# 20. Docker development environment

`docker-compose.yml` should initially contain:

```text
api
postgres
```

Do not add infrastructure that the MVP does not use.

Developer startup target:

```bash
docker compose up --build
```

API:

```text
http://localhost:8000
```

Docs:

```text
http://localhost:8000/docs
```

---

# 21. Testing requirements

Minimum automated test categories:

## Auth

- valid login;
- wrong password;
- inactive account;
- token refresh;
- expired/invalid token.

## Tenant isolation

A teacher/admin from School A must never retrieve School B data.

## Teacher access

Teacher A cannot access an unassigned student.

## Weekly records

- valid create;
- update same week;
- invalid attendance;
- invalid score;
- wrong tenant;
- batch insert.

## Feature builder

Use deterministic small histories and assert:

- attendance percent;
- rolling average;
- change;
- volatility;
- streak.

## Prediction

- model feature ordering;
- missing optional feature handling;
- stored model version;
- stored feature snapshot;
- threshold mapping.

## Intervention

- create;
- update;
- complete;
- unauthorized access;
- student visibility.

## Student dashboard

Ensure raw internal risk fields are absent.

---

# 22. Observability

Use structured application logging.

Include:

```text
request_id
user_id when available
school_id when available
route
status_code
latency
```

Do not include sensitive free text or auth credentials.

---

# 23. MVP boundaries

Do not build these before the core backend works:

- microservices;
- Kubernetes;
- Kafka;
- real-time websockets;
- complex event sourcing;
- LLM-generated counseling recommendations;
- automatic disciplinary decisions;
- parent mobile application;
- custom domain SSL automation;
- advanced SHAP UI;
- Redis/Celery unless needed by actual load.

Keep the first backend understandable and testable.

---

# 24. Definition of a complete backend MVP

The backend MVP is complete when:

1. a school admin can create a school structure;
2. admin can create teachers and students;
3. admin can assign teacher -> course/class;
4. admin can enroll students;
5. teacher can see only assigned students;
6. teacher can create/update weekly records;
7. backend derives features from history;
8. backend can run the supplied/baseline ML pipeline;
9. prediction is saved with model and feature versions;
10. teacher sees useful signals explaining the prediction;
11. backend returns recommended interventions;
12. teacher can create and track an intervention;
13. student can log in and see only their own progress;
14. student does not receive raw internal risk scoring by default;
15. tenant isolation has automated tests;
16. Docker startup and migrations work from a clean database;
17. `/docs` exposes the complete API.

---

# 25. Non-negotiable implementation rules for Codex

1. Do not hardcode a single school.
2. Do not hardcode Math/Physics/Chemistry as database columns.
3. Do not make teachers enter derived ML features.
4. Do not use `Risk_Score`, `Risk_Level`, or `At_Risk` as model input features.
5. Do not use student PII as model features.
6. Do not overwrite history when a new week arrives.
7. Do not expose another school's records.
8. Do not allow teachers to access unassigned students.
9. Do not return raw internal risk to the student API by default.
10. Do not let recommendations create interventions automatically.
11. Persist the model version and exact feature snapshot for every prediction.
12. Keep training code separate from online inference.
13. Add tests as each module is built.
14. Run migrations and the complete test suite before considering a phase complete.
