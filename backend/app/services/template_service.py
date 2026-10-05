from uuid import UUID

from sqlalchemy.orm import Session

from app.models import InterventionTemplate, User
from app.schemas.recommendation import TemplateCreate, TemplatePatch
from app.services.common import audit, tenant_row, transaction


def create_template(db: Session, actor: User, data: TemplateCreate) -> InterventionTemplate:
    with transaction(db):
        row = InterventionTemplate(school_id=actor.school_id, **data.model_dump())
        db.add(row)
        db.flush()
        audit(db, actor, "template.created", "intervention_template", row.id)
    return row


def patch_template(
    db: Session, actor: User, template_id: UUID, data: TemplatePatch
) -> InterventionTemplate:
    with transaction(db):
        row = tenant_row(db, InterventionTemplate, actor.school_id, template_id, lock=True)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        audit(
            db,
            actor,
            "template.updated",
            "intervention_template",
            row.id,
            {"fields": sorted(data.model_fields_set)},
        )
    return row
