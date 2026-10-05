from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import EnrollmentStatus, Role
from app.db.base import Base


def enum_type(enum, name):
    return Enum(
        enum,
        name=name,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda values: [v.value for v in values],
    )


class Identity:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Tenant:
    school_id: Mapped[UUID] = mapped_column(ForeignKey("schools.id"), index=True)


class School(Identity, Timestamps, Base):
    __tablename__ = "schools"
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    domain: Mapped[str | None] = mapped_column(String(253))
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    users: Mapped[list["User"]] = relationship(back_populates="school")


class User(Identity, Tenant, Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("school_id", "email"), UniqueConstraint("school_id", "id"))
    email: Mapped[str] = mapped_column(CITEXT())
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(enum_type(Role, "user_role"))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    school: Mapped[School] = relationship(back_populates="users")


class TeacherProfile(Identity, Tenant, Timestamps, Base):
    __tablename__ = "teacher_profiles"
    __table_args__ = (
        UniqueConstraint("school_id", "id"),
        ForeignKeyConstraint(["school_id", "user_id"], ["users.school_id", "users.id"]),
    )
    user_id: Mapped[UUID] = mapped_column(unique=True)
    employee_code: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(40))
    user: Mapped[User] = relationship(viewonly=True)


class StudentProfile(Identity, Tenant, Timestamps, Base):
    __tablename__ = "student_profiles"
    __table_args__ = (
        UniqueConstraint("school_id", "id"),
        UniqueConstraint("school_id", "roll_number"),
        ForeignKeyConstraint(["school_id", "user_id"], ["users.school_id", "users.id"]),
    )
    user_id: Mapped[UUID] = mapped_column(unique=True)
    roll_number: Mapped[str] = mapped_column(String(100))
    grade_label: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(Text)
    guardian_name: Mapped[str | None] = mapped_column(String(200))
    guardian_contact: Mapped[str | None] = mapped_column(String(200))
    user: Mapped[User] = relationship(viewonly=True)
    enrollments: Mapped[list["Enrollment"]] = relationship(viewonly=True)


class Classroom(Identity, Tenant, Timestamps, Base):
    __tablename__ = "classrooms"
    __table_args__ = (UniqueConstraint("school_id", "id"),)
    name: Mapped[str] = mapped_column(String(100))
    grade_label: Mapped[str] = mapped_column(String(50))
    academic_year: Mapped[str] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")


class Subject(Identity, Tenant, Timestamps, Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("school_id", "id"), UniqueConstraint("school_id", "code"))
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(100))


class CourseOffering(Identity, Tenant, Timestamps, Base):
    __tablename__ = "course_offerings"
    __table_args__ = (
        UniqueConstraint("school_id", "id"),
        ForeignKeyConstraint(
            ["school_id", "classroom_id"], ["classrooms.school_id", "classrooms.id"]
        ),
        ForeignKeyConstraint(["school_id", "subject_id"], ["subjects.school_id", "subjects.id"]),
    )
    classroom_id: Mapped[UUID]
    subject_id: Mapped[UUID]
    academic_year: Mapped[str] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    classroom: Mapped[Classroom] = relationship(viewonly=True)
    subject: Mapped[Subject] = relationship(viewonly=True)
    teacher_assignments: Mapped[list["CourseTeacher"]] = relationship(viewonly=True)
    enrollments: Mapped[list["Enrollment"]] = relationship(viewonly=True)


class CourseTeacher(Tenant, Base):
    __tablename__ = "course_teachers"
    __table_args__ = (
        ForeignKeyConstraint(
            ["school_id", "course_offering_id"],
            ["course_offerings.school_id", "course_offerings.id"],
        ),
        ForeignKeyConstraint(
            ["school_id", "teacher_id"], ["teacher_profiles.school_id", "teacher_profiles.id"]
        ),
        Index("ix_course_teachers_teacher_course", "school_id", "teacher_id", "course_offering_id"),
    )
    course_offering_id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column(primary_key=True)
    is_primary: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    teacher: Mapped[TeacherProfile] = relationship(viewonly=True)
    course: Mapped[CourseOffering] = relationship(viewonly=True)


class Enrollment(Identity, Tenant, Timestamps, Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("school_id", "student_id", "course_offering_id"),
        UniqueConstraint("student_id", "course_offering_id"),
        ForeignKeyConstraint(
            ["school_id", "student_id"], ["student_profiles.school_id", "student_profiles.id"]
        ),
        ForeignKeyConstraint(
            ["school_id", "course_offering_id"],
            ["course_offerings.school_id", "course_offerings.id"],
        ),
        Index("ix_enrollments_school_course", "school_id", "course_offering_id"),
    )
    student_id: Mapped[UUID]
    course_offering_id: Mapped[UUID]
    status: Mapped[EnrollmentStatus] = mapped_column(
        enum_type(EnrollmentStatus, "enrollment_status"),
        default=EnrollmentStatus.ACTIVE,
        server_default="active",
    )
    enrolled_at: Mapped[date]
    student: Mapped[StudentProfile] = relationship(viewonly=True)
    course: Mapped[CourseOffering] = relationship(viewonly=True)
