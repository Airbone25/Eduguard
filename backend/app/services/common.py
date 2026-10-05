from collections.abc import Generator
from contextlib import contextmanager
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.db.base import Base
from app.models import AuditLog, User


def tenant_row(db: Session, model: type[Base], school_id: UUID, row_id: UUID, *, lock=False):
    query = select(model).where(model.school_id == school_id, model.id == row_id)
    if lock:
        query = query.with_for_update()
    row = db.scalar(query)
    if row is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource not found.")
    return row


def audit(
    db: Session, actor: User, action: str, entity: str, row_id: UUID, details: dict | None = None
) -> None:
    db.add(
        AuditLog(
            school_id=actor.school_id,
            actor_user_id=actor.id,
            action=action,
            entity_type=entity,
            entity_id=row_id,
            details=details or {},
        )
    )


@contextmanager
def transaction(db: Session) -> Generator[None]:
    try:
        yield
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "DATA_CONFLICT", "The requested data conflicts with an existing record."
        ) from exc
    except Exception:
        db.rollback()
        raise
