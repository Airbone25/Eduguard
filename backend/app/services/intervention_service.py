from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import InterventionStatus, InterventionUpdateKind
from app.core.exceptions import APIError
from app.core.permissions import authorized_student, teacher_course_ids, teacher_has_course_access
from app.models import Intervention, InterventionUpdate, RiskPrediction, User
from app.schemas.intervention import InterventionCreate, InterventionPatch
from app.services.common import audit, tenant_row, transaction
from app.services.recommendation_service import available_templates
from app.services.weekly_record_service import authorized_enrollment

ALLOWED_TRANSITIONS = {
    InterventionStatus.PLANNED: {InterventionStatus.ACTIVE, InterventionStatus.CANCELLED},
    InterventionStatus.ACTIVE: {InterventionStatus.CANCELLED},
    InterventionStatus.COMPLETED: set(),
    InterventionStatus.CANCELLED: set(),
}


def authorized_intervention(
    db: Session, teacher: User, intervention_id: UUID, *, lock: bool = False
) -> Intervention:
    """Tenant row plus a live assignment check, so a revoked assignment loses access."""
    row = tenant_row(db, Intervention, teacher.school_id, intervention_id, lock=lock)
    if not teacher_has_course_access(db, teacher, row.course_offering_id):
        raise APIError(404, "INTERVENTION_NOT_FOUND", "Intervention not found.")
    return row


def append_update(
    db: Session,
    teacher: User,
    intervention: Intervention,
    kind: InterventionUpdateKind,
    note: str | None,
    details: dict | None = None,
) -> InterventionUpdate:
    # The caller holds the parent row lock, so this stays unique and ordered.
    sequence = db.scalar(
        select(func.coalesce(func.max(InterventionUpdate.sequence), 0)).where(
            InterventionUpdate.school_id == teacher.school_id,
            InterventionUpdate.intervention_id == intervention.id,
        )
    )
    row = InterventionUpdate(
        school_id=teacher.school_id,
        intervention_id=intervention.id,
        author_user_id=teacher.id,
        sequence=sequence + 1,
        kind=kind,
        note=note,
        details=details or {},
    )
    db.add(row)
    return row


def create_intervention(
    db: Session, teacher: User, student_id: UUID, data: InterventionCreate
) -> Intervention:
    authorized_enrollment(db, teacher, student_id, data.course_offering_id)
    if data.template_id is not None and not any(
        row.id == data.template_id for row in available_templates(db, teacher.school_id)
    ):
        raise APIError(422, "INVALID_TEMPLATE", "Template is not available to this school.")
    if data.prediction_id is not None:
        prediction = db.scalar(
            select(RiskPrediction).where(
                RiskPrediction.school_id == teacher.school_id,
                RiskPrediction.id == data.prediction_id,
                RiskPrediction.student_id == student_id,
                RiskPrediction.course_offering_id == data.course_offering_id,
            )
        )
        if prediction is None:
            raise APIError(
                422,
                "INVALID_PREDICTION",
                "Prediction does not belong to this student and course.",
            )
    with transaction(db):
        row = Intervention(
            school_id=teacher.school_id,
            student_id=student_id,
            course_offering_id=data.course_offering_id,
            template_id=data.template_id,
            prediction_id=data.prediction_id,
            title=data.title,
            frequency=data.frequency,
            status=data.status,
            start_date=data.start_date,
            review_date=data.review_date,
            visibility_to_student=data.visibility_to_student,
            goal_definition=data.goal_definition,
            created_by=teacher.id,
        )
        db.add(row)
        db.flush()
        append_update(
            db,
            teacher,
            row,
            InterventionUpdateKind.CREATED,
            f"Intervention '{row.title}' created.",
            {
                "status": row.status.value,
                "prediction_id": str(row.prediction_id) if row.prediction_id else None,
                "template_id": str(row.template_id) if row.template_id else None,
                "visibility_to_student": row.visibility_to_student,
                "goal_definition": row.goal_definition,
                "frequency": row.frequency,
            },
        )
        audit(
            db,
            teacher,
            "intervention.created",
            "intervention",
            row.id,
            {
                "student_id": str(student_id),
                "course_offering_id": str(row.course_offering_id),
                "status": row.status.value,
            },
        )
    return row


def list_interventions(
    db: Session,
    teacher: User,
    student_id: UUID,
    course_id: UUID | None,
    status: InterventionStatus | None,
    limit: int,
    offset: int,
) -> list[Intervention]:
    authorized_student(db, teacher, student_id)
    course_ids = teacher_course_ids(db, teacher)
    if not course_ids:
        return []
    if course_id is not None:
        authorized_enrollment(db, teacher, student_id, course_id)
        course_ids = [course_id]
    query = select(Intervention).where(
        Intervention.school_id == teacher.school_id,
        Intervention.student_id == student_id,
        Intervention.course_offering_id.in_(course_ids),
    )
    if status is not None:
        query = query.where(Intervention.status == status)
    return list(
        db.scalars(
            query.order_by(Intervention.start_date.desc(), Intervention.id)
            .limit(limit)
            .offset(offset)
        )
    )


def get_intervention(db: Session, teacher: User, intervention_id: UUID) -> Intervention:
    return authorized_intervention(db, teacher, intervention_id)


def teacher_interventions(
    db: Session,
    teacher: User,
    course_id: UUID | None,
    status: InterventionStatus | None,
    limit: int,
    offset: int,
):
    course_ids = teacher_course_ids(db, teacher)
    if course_id is not None:
        if course_id not in course_ids:
            raise APIError(404, "COURSE_NOT_FOUND", "Course not found.")
        course_ids = [course_id]
    query = select(Intervention).where(
        Intervention.school_id == teacher.school_id,
        Intervention.course_offering_id.in_(course_ids),
    )
    if status is not None:
        query = query.where(Intervention.status == status)
    return list(
        db.scalars(
            query.order_by(Intervention.start_date.desc(), Intervention.id)
            .limit(limit)
            .offset(offset)
        )
    )


def patch_intervention(
    db: Session, teacher: User, intervention_id: UUID, data: InterventionPatch
) -> Intervention:
    changes = data.model_dump(exclude_unset=True)
    with transaction(db):
        row = authorized_intervention(db, teacher, intervention_id, lock=True)
        if "status" in changes:
            target = changes.pop("status")
            if target is InterventionStatus.COMPLETED:
                raise APIError(
                    422,
                    "INVALID_STATUS_TRANSITION",
                    "Use the complete action to finish an intervention.",
                )
            if target not in ALLOWED_TRANSITIONS[row.status]:
                raise APIError(
                    422,
                    "INVALID_STATUS_TRANSITION",
                    f"Cannot move an intervention from {row.status.value} to {target.value}.",
                )
            append_update(
                db,
                teacher,
                row,
                InterventionUpdateKind.STATUS_CHANGE,
                f"Status changed from {row.status.value} to {target.value}.",
                {"from": row.status.value, "to": target.value},
            )
            row.status = target
        for field, value in changes.items():
            setattr(row, field, value)
        if row.review_date is not None and row.review_date < row.start_date:
            raise APIError(422, "INVALID_REVIEW_DATE", "review_date precedes start_date.")
        audit(
            db,
            teacher,
            "intervention.updated",
            "intervention",
            row.id,
            {"fields": sorted(data.model_fields_set)},
        )
    return row


def add_update(db: Session, teacher: User, intervention_id: UUID, note: str) -> InterventionUpdate:
    with transaction(db):
        row = authorized_intervention(db, teacher, intervention_id, lock=True)
        update = append_update(db, teacher, row, InterventionUpdateKind.NOTE, note)
        db.flush()
        audit(
            db,
            teacher,
            "intervention.note_added",
            "intervention",
            row.id,
            {"update_id": str(update.id)},
        )
    return update


def list_updates(
    db: Session, teacher: User, intervention_id: UUID, limit: int, offset: int
) -> list[InterventionUpdate]:
    authorized_intervention(db, teacher, intervention_id)
    return list(
        db.scalars(
            select(InterventionUpdate)
            .where(
                InterventionUpdate.school_id == teacher.school_id,
                InterventionUpdate.intervention_id == intervention_id,
            )
            .order_by(InterventionUpdate.sequence)
            .limit(limit)
            .offset(offset)
        )
    )


def complete_intervention(db: Session, teacher: User, intervention_id: UUID) -> Intervention:
    with transaction(db):
        row = tenant_row(db, Intervention, teacher.school_id, intervention_id, lock=True)
        if not teacher_has_course_access(db, teacher, row.course_offering_id):
            raise APIError(404, "INTERVENTION_NOT_FOUND", "Intervention not found.")
        if row.status is InterventionStatus.COMPLETED:
            raise APIError(409, "ALREADY_COMPLETED", "Intervention is already completed.")
        if row.status is InterventionStatus.CANCELLED:
            raise APIError(
                422, "INVALID_STATUS_TRANSITION", "A cancelled intervention cannot be completed."
            )
        append_update(
            db,
            teacher,
            row,
            InterventionUpdateKind.COMPLETED,
            f"Intervention '{row.title}' completed.",
            {"from": row.status.value, "completed_at": datetime.now(UTC).isoformat()},
        )
        row.status = InterventionStatus.COMPLETED
        row.completed_at = datetime.now(UTC)
        audit(db, teacher, "intervention.completed", "intervention", row.id, {})
    return row
