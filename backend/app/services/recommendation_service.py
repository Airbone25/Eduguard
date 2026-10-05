from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import InterventionTemplate


def available_templates(db: Session, school_id: UUID) -> list[InterventionTemplate]:
    rows = db.scalars(
        select(InterventionTemplate)
        .where(
            or_(
                InterventionTemplate.school_id == school_id,
                InterventionTemplate.school_id.is_(None),
            )
        )
        .order_by(InterventionTemplate.name)
    ).all()
    # A school's same-name override can customize or disable a global default.
    by_name = {row.name: row for row in rows if row.school_id is None}
    by_name.update({row.name: row for row in rows if row.school_id == school_id})
    return [by_name[name] for name in sorted(by_name)]


def recommend(db: Session, school_id: UUID, signals: list[dict]) -> list[dict]:
    factors = {signal["factor"]: signal["severity"] for signal in signals}
    result = []
    for template in available_templates(db, school_id):
        if not template.is_active:
            continue
        weights = template.tags
        score = sum(factors.get(tag, 0) * weight for tag, weight in weights.items())
        if score <= 0:
            continue
        reason = max(signals, key=lambda s: factors[s["factor"]] * weights.get(s["factor"], 0))
        result.append(
            {
                "template_id": str(template.id),
                "name": template.name,
                "match_score": round(score, 6),
                "reason": reason["message"],
            }
        )
    return sorted(result, key=lambda r: (-r["match_score"], r["name"]))[:3]
