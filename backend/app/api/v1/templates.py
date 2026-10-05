from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_school_admin
from app.db.session import get_db
from app.models import User
from app.schemas.recommendation import TemplateCreate, TemplatePatch, TemplateResponse
from app.services.recommendation_service import available_templates
from app.services.template_service import create_template, patch_template

router = APIRouter(prefix="/admin/intervention-templates", tags=["recommendation catalog"])


@router.get("", response_model=list[TemplateResponse])
def templates(actor: User = Depends(require_school_admin), db: Session = Depends(get_db)):
    return available_templates(db, actor.school_id)


@router.post("", response_model=TemplateResponse, status_code=201)
def create(
    data: TemplateCreate, actor: User = Depends(require_school_admin), db: Session = Depends(get_db)
):
    return create_template(db, actor, data)


@router.patch("/{template_id}", response_model=TemplateResponse)
def patch(
    template_id: UUID,
    data: TemplatePatch,
    actor: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    return patch_template(db, actor, template_id, data)
