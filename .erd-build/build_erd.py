from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
import app.models
from app.db.base import Base
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects import postgresql

OUT = ROOT / 'outputs' / 'eduguard-erd'
OUT.mkdir(parents=True, exist_ok=True)
tables = Base.metadata.tables
order = ['schools', 'users', 'teacher_profiles', 'student_profiles', 'classrooms', 'subjects', 'course_offerings', 'course_teachers', 'enrollments', 'weekly_records', 'feature_snapshots', 'model_versions', 'risk_predictions', 'intervention_templates', 'interventions', 'intervention_updates', 'refresh_tokens', 'audit_logs', 'import_jobs']

def unique_sets(t):
    result = [set(c.name for c in t.primary_key.columns)]
    result += [set(c.name for c in u.columns) for u in t.constraints if isinstance(u, UniqueConstraint)]
    result += [set(c.name for c in ix.columns) for ix in t.indexes if ix.unique and ix.dialect_options['postgresql'].get('where') is None]
    return result

def entity(t):
    lines = [f'    {t.name} {{']
    unique = unique_sets(t)
    cols = sorted(t.columns, key=lambda c: (c.name != 'id', c.name != 'school_id', list(t.columns).index(c)))
    for c in cols:
        datatype = re.sub(r'[^A-Za-z0-9_]', '_', c.type.compile(dialect=postgresql.dialect())).strip('_').lower()
        datatype = re.sub('_+', '_', datatype)
        keys = []
        if c.primary_key:
            keys.append('PK')
        if c.foreign_keys:
            keys.append('FK')
        if {c.name} in unique and not c.primary_key:
            keys.append('UK')
        key = ' ' + ','.join(keys) if keys else ''
        comment = ' "nullable"' if c.nullable else ''
        lines.append(f'        {datatype} {c.name}{key}{comment}')
    return lines + ['    }']

def relations(names, school_edges=True):
    lines = []
    for name in names:
        t = tables[name]
        for fk in sorted(t.foreign_key_constraints, key=lambda f: tuple(c.name for c in f.columns)):
            parent = fk.referred_table.name
            if parent not in names or (not school_edges and parent == 'schools'):
                continue
            local = {c.name for c in fk.columns}
            optional = any(c.nullable for c in fk.columns)
            onechild = any(u and u.issubset(local) for u in unique_sets(t))
            left = '|o' if optional else '||'
            right = 'o|' if onechild else 'o{'
            label = ', '.join(c.name for c in fk.columns)
            lines.append(f'    {parent} {left}..{right} {name} : "{label}"')
    return lines

lines = ['erDiagram', '    direction TB']
for name in order:
    lines += entity(tables[name])
lines += relations(order)
full = '\n'.join(lines) + '\n'
(OUT / 'EduGuard_Complete_ER_Diagram.mmd').write_text(full, encoding='utf-8')

overview = '''erDiagram
    schools ||..o{ users : has
    schools ||..o{ classrooms : has
    schools ||..o{ subjects : offers
    users ||..o| teacher_profiles : teacher_account
    users ||..o| student_profiles : student_account
    classrooms ||..o{ course_offerings : contains
    subjects ||..o{ course_offerings : taught_as
    teacher_profiles ||..o{ course_teachers : assigned_through
    course_offerings ||..o{ course_teachers : has_teachers
    student_profiles ||..o{ enrollments : joins_through
    course_offerings ||..o{ enrollments : has_students
    enrollments ||..o{ weekly_records : has_weekly_observations
    student_profiles ||..o{ feature_snapshots : has_feature_history
    feature_snapshots |o..o{ risk_predictions : referenced_by
    model_versions ||..o{ risk_predictions : model_used
    student_profiles ||..o{ risk_predictions : assessed_for
    risk_predictions |o..o{ interventions : may_inform
    student_profiles ||..o{ interventions : receives_support
    intervention_templates |o..o{ interventions : may_use
    interventions ||..o{ intervention_updates : has_timeline
    users ||..o{ refresh_tokens : has_sessions
    users |o..o{ audit_logs : may_be_actor
    users ||..o{ import_jobs : uploads
'''
(OUT / 'EduGuard_Overview_ER_Diagram.mmd').write_text(overview, encoding='utf-8')

notes = '''# EduGuard backend ER diagrams

Based on the SQLAlchemy models in `backend/app/models`, with nine migration files in `backend/alembic/versions`. This describes the repository schema, not an inspection of a running database.

## Reading the diagram

- PK: primary key. FK: foreign key. UK: a unique single-column value.
- `||`: exactly one. `o|` or `|o`: zero or one. `o{`: zero or many.
- Lines connect parent rows with referencing rows. Refer to the explicit key declarations for composite keys.
- A course offering means a subject taught to a classroom for an academic year.
- The overview shows selected relationships. The complete diagram includes every declared foreign key and every column.

## Presentation overview

```mermaid
'''+overview+'''```

## Important schema details

- School-scoped tables carry `school_id`. Composite foreign keys combine it with the related record identifiers. The overview omits repeated school links to stay readable.
- `course_teachers` joins teachers to course offerings. Its primary key is `(course_offering_id, teacher_id)`.
- `enrollments` joins students to course offerings. A student/course pair is unique.
- `weekly_records` links to an enrollment through `(school_id, student_id, course_offering_id)`. There is no `enrollment_id` column. Only one record per student, course and week is allowed.
- `feature_snapshots.features` stores a JSONB feature payload. There is no separate table for each of the 40 features.
- Feature extraction reads weekly records in application code. There is no direct foreign key from `feature_snapshots` to `weekly_records`.
- Predictions reference the model version and a feature snapshot. Their composite snapshot foreign key also includes the student and course. The course can be null, so PostgreSQL's default MATCH SIMPLE behaviour means this constraint does not enforce the snapshot link in that case. The overview marks this relationship optional at the database-constraint level even though `feature_snapshot_id` itself is required.
- An intervention can optionally reference a prediction and/or template. An intervention has many timeline updates. Goals are stored in `goal_definition` JSONB, not in a separate goals table.
- `model_versions` is global. `intervention_templates.school_id` can be null for shared templates. The intervention-to-template foreign key uses `template_id` alone, so template access also depends on application checks.
- `users.role` distinguishes admin, teacher and student accounts. There is no separate admin table.
- Authentication sessions, audit history and CSV imports live in `refresh_tokens`, `audit_logs` and `import_jobs`.

## Complete physical ER diagram

The following contains all 19 tables and their columns. Repeated school and author links make this view more suitable for documentation than a single presentation slide.

```mermaid
'''+full+'''```

## Composite uniqueness

'''
for name in order:
    t = tables[name]
    keys = [tuple(c.name for c in con.columns) for con in t.constraints if isinstance(con, UniqueConstraint) and len(con.columns)>1]
    if keys:
        notes += f'- `{name}`: ' + '; '.join('`('+', '.join(cols)+')`' for cols in sorted(keys)) + '.\n'
notes += '''
Partial unique indexes additionally allow at most one active model version and require global intervention-template names to be unique.

## Simple explanation for the panel

Each school has user accounts, classrooms and subjects. Teachers and students connect to specific courses through assignment and enrollment records. Weekly observations record how an enrolled student is doing. The system builds feature snapshots and stores predictions with the model version used. Teachers can record support actions and track their progress through intervention updates.
'''
(OUT / 'EduGuard_Backend_ER_Diagrams.md').write_text(notes, encoding='utf-8')
print(json.dumps({'tables':len(tables),'foreign_keys':sum(len(t.foreign_key_constraints) for t in tables.values()),'files':[p.name for p in OUT.iterdir()]},indent=2))
