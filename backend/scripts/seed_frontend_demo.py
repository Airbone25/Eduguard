"""Synthetic school for frontend acceptance. Never changes an existing school."""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.core.enums import Role
from app.core.security import hash_password
from app.db.seed import DEMO_PASSWORD
from app.db.session import SessionLocal
from app.models import (
    Classroom,
    CourseOffering,
    CourseTeacher,
    Enrollment,
    School,
    StudentProfile,
    Subject,
    TeacherProfile,
    User,
    WeeklyRecord,
)


def main():
    if get_settings().environment != "development":
        raise SystemExit("This synthetic fixture is only for development.")
    with SessionLocal.begin() as db:
        if db.scalar(select(School).where(School.slug == "frontend-demo")):
            print("frontend-demo already exists; nothing changed.")
            return
        day = datetime.now(UTC).date()
        monday = day - timedelta(days=day.weekday())
        school = School(name="Frontend Demo School (Synthetic)", slug="frontend-demo")
        db.add(school)
        db.flush()
        users = {}
        password = hash_password(DEMO_PASSWORD)
        for email, first, last, role in [
            ("admin", "Demo", "Administrator", Role.SCHOOL_ADMIN),
            ("teacher", "Maya", "Sharma", Role.TEACHER),
            ("student", "Riya", "Patel", Role.STUDENT),
            ("student2", "Arjun", "Shah", Role.STUDENT),
            ("student3", "Neha", "Das", Role.STUDENT),
        ]:
            row = User(
                school_id=school.id,
                email=f"{email}@demo.edu",
                first_name=first,
                last_name=last,
                role=role,
                password_hash=password,
            )
            db.add(row)
            users[email] = row
        db.flush()
        teacher = TeacherProfile(school_id=school.id, user_id=users["teacher"].id)
        classroom = Classroom(
            school_id=school.id, name="Grade 10-A", grade_label="10", academic_year=str(day.year)
        )
        subject = Subject(school_id=school.id, code="MATH", name="Mathematics")
        db.add_all([teacher, classroom, subject])
        db.flush()
        course = CourseOffering(
            school_id=school.id,
            classroom_id=classroom.id,
            subject_id=subject.id,
            academic_year=str(day.year),
        )
        db.add(course)
        db.flush()
        db.add(
            CourseTeacher(
                school_id=school.id,
                course_offering_id=course.id,
                teacher_id=teacher.id,
                is_primary=True,
            )
        )
        for index, key in enumerate(["student", "student2", "student3"]):
            student = StudentProfile(
                school_id=school.id,
                user_id=users[key].id,
                roll_number=f"S00{index + 1}",
                grade_label="10",
            )
            db.add(student)
            db.flush()
            db.add(
                Enrollment(
                    school_id=school.id,
                    student_id=student.id,
                    course_offering_id=course.id,
                    enrolled_at=date(day.year, 1, 1),
                )
            )
            db.flush()
            # Leave the current week blank for testing the batch-entry screen.
            for ago in range(1, 8):
                db.add(
                    WeeklyRecord(
                        school_id=school.id,
                        student_id=student.id,
                        course_offering_id=course.id,
                        week_start=monday - timedelta(weeks=ago),
                        classes_held=10,
                        classes_attended=5 + min(ago, 5) if index == 0 else 9,
                        assessment_avg_score=50 + ago * 5 if index == 0 else 75 + index * 5,
                        assessment_count=2,
                        assignment_count=5,
                        assignments_completed=4,
                        late_submissions=2 if index == 0 else 0,
                        assignment_avg_score=70,
                        quiz_avg_score=65,
                        study_hours_weekly=5,
                        participation_count=3,
                        participation_opportunities=5,
                        created_by=users["teacher"].id,
                    )
                )
        db.flush()
    print("Synthetic school created: frontend-demo. See frontend README for demo accounts.")


if __name__ == "__main__":
    main()
