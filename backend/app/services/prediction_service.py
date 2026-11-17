from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import and_, not_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.ml.explain import feature_contributions
from app.ml.inference import ordered_features, predict
from app.ml.model_loader import LoadedModel
from app.models import CourseOffering, FeatureSnapshot, ModelVersion, RiskPrediction, Subject, User
from app.schemas.prediction import (
    PredictionResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.services.common import audit, tenant_row, transaction
from app.services.explanation_service import explanation_signals
from app.services.feature_service import build_student_features
from app.services.recommendation_service import recommend
from app.services.teacher_service import list_students
from app.services.weekly_record_service import authorized_enrollment


def registered_version(db: Session, model: LoadedModel) -> ModelVersion:
    meta = model.metadata
    identity = and_(
        ModelVersion.name == meta["model_name"],
        ModelVersion.version == meta["model_version"],
    )
    # The registry keeps exactly one active version. Deactivate every other
    # version, then activate the loaded artifact — so a legitimately retrained
    # artifact swaps in cleanly, while a row whose checksum no longer matches
    # the artifact still fails validation below instead of being overwritten.
    db.execute(
        update(ModelVersion)
        .where(ModelVersion.is_active.is_(True), not_(identity))
        .values(is_active=False)
    )
    db.execute(
        pg_insert(ModelVersion)
        .values(
            name=meta["model_name"],
            version=meta["model_version"],
            artifact_path=model.artifact_path,
            artifact_sha256=meta["artifact_sha256"],
            feature_version=meta["feature_version"],
            thresholds=meta["thresholds"],
            metrics=meta.get("metrics", {}),
            trained_at=(
                datetime.fromisoformat(meta["trained_at"]).replace(tzinfo=UTC)
                if meta.get("trained_at")
                else None
            ),
            is_active=True,
        )
        .on_conflict_do_update(index_elements=["name", "version"], set_={"is_active": True})
    )
    version = db.scalar(select(ModelVersion).where(identity))
    if (
        version is None
        or not version.is_active
        or version.artifact_sha256 != meta["artifact_sha256"]
        or version.feature_version != meta["feature_version"]
        or version.thresholds != meta["thresholds"]
    ):
        raise APIError(
            503,
            "MODEL_VERSION_CONFLICT",
            "Active model registry does not match the loaded artifact.",
        )
    return version


def response(
    row: RiskPrediction, snapshot: FeatureSnapshot, version: ModelVersion, model: LoadedModel
) -> PredictionResponse:
    # Attributions are recomputed from the stored snapshot against the current
    # model: the explanation always reflects the model that is deployed now,
    # re-evaluating the exact recorded inputs.
    try:
        explained = feature_contributions(model, snapshot.features.get("values", {}))
    except (ValueError, TypeError, KeyError):
        explained = {"contributions": [], "exact": False, "intercept": None, "logit": None}
    return PredictionResponse(
        id=row.id,
        student_id=row.student_id,
        course_offering_id=row.course_offering_id,
        as_of_date=snapshot.as_of_date,
        created_at=row.created_at,
        model_version_id=version.id,
        model_version=version.version,
        feature_snapshot_id=snapshot.id,
        feature_version=snapshot.feature_version,
        risk_probability=float(row.risk_probability),
        risk_level=row.risk_level,
        at_risk=row.at_risk,
        support_level={"low": "doing_well", "medium": "watch", "high": "priority_support"}[
            row.risk_level
        ],
        signals=row.explanations,
        recommendations=row.recommendations,
        contributions=explained["contributions"],
    )


def predict_one(
    db: Session,
    teacher: User,
    student_id: UUID,
    course_id: UUID,
    as_of_date: date,
    model: LoadedModel,
) -> PredictionResponse:
    built = build_student_features(db, teacher, student_id, course_id, as_of_date)
    course = tenant_row(db, CourseOffering, teacher.school_id, course_id)
    subject = tenant_row(db, Subject, teacher.school_id, course.subject_id)
    inputs = ordered_features(model, built, subject.code, subject.name)
    if not built.metadata["history_weeks_available"] or not any(
        v is not None for v in inputs.values()
    ):
        raise APIError(
            422, "INSUFFICIENT_HISTORY", "No usable weekly observations exist at this date."
        )
    try:
        output = predict(model, inputs)
    except (ValueError, TypeError) as exc:
        raise APIError(
            503, "INFERENCE_FAILED", "The pretrained model could not process these observations."
        ) from exc
    version = registered_version(db, model)
    snapshot = FeatureSnapshot(
        school_id=teacher.school_id,
        student_id=student_id,
        course_offering_id=course_id,
        as_of_date=as_of_date,
        feature_version=built.feature_version,
        features={
            "feature_names": list(model.feature_names),
            "values": inputs,
            "engineered": built.features,
            "metadata": {
                **built.metadata,
                "adapter_version": model.metadata["adapter_version"],
                "missing_features": [name for name, value in inputs.items() if value is None],
            },
        },
    )
    db.add(snapshot)
    db.flush()
    signals = explanation_signals(built.features)
    row = RiskPrediction(
        school_id=teacher.school_id,
        student_id=student_id,
        course_offering_id=course_id,
        feature_snapshot_id=snapshot.id,
        model_version_id=version.id,
        created_by=teacher.id,
        risk_probability=output["risk_probability"],
        risk_level=output["risk_level"],
        at_risk=output["at_risk"],
        explanations=signals,
        recommendations=recommend(db, teacher.school_id, signals),
    )
    db.add(row)
    db.flush()
    audit(
        db,
        teacher,
        "prediction.created",
        "risk_prediction",
        row.id,
        {"model_version_id": str(version.id), "feature_snapshot_id": str(snapshot.id)},
    )
    return response(row, snapshot, version, model)


def predict_student(
    db: Session,
    teacher: User,
    student_id: UUID,
    course_id: UUID,
    as_of_date: date,
    model: LoadedModel,
) -> PredictionResponse:
    with transaction(db):
        result = predict_one(db, teacher, student_id, course_id, as_of_date, model)
    return result


def predict_class(
    db: Session, teacher: User, course_id: UUID, as_of_date: date, model: LoadedModel
) -> list[PredictionResponse]:
    with transaction(db):
        students = list_students(db, teacher, course_id, 101, 0)
        if len(students) > 100:
            raise APIError(
                422,
                "CLASS_BATCH_TOO_LARGE",
                "Synchronous class prediction is limited to 100 students.",
            )
        result = [
            predict_one(db, teacher, student.id, course_id, as_of_date, model)
            for student in students
        ]
    return result


def list_predictions(
    db: Session,
    teacher: User,
    student_id: UUID,
    course_id: UUID,
    limit: int,
    offset: int,
    model: LoadedModel,
) -> list[PredictionResponse]:
    authorized_enrollment(db, teacher, student_id, course_id)
    rows = db.execute(
        select(RiskPrediction, FeatureSnapshot, ModelVersion)
        .join(FeatureSnapshot, FeatureSnapshot.id == RiskPrediction.feature_snapshot_id)
        .join(ModelVersion, ModelVersion.id == RiskPrediction.model_version_id)
        .where(
            RiskPrediction.school_id == teacher.school_id,
            FeatureSnapshot.school_id == teacher.school_id,
            RiskPrediction.student_id == student_id,
            RiskPrediction.course_offering_id == course_id,
        )
        .order_by(RiskPrediction.created_at.desc(), RiskPrediction.id)
        .limit(limit)
        .offset(offset)
    )
    return [response(row, snapshot, version, model) for row, snapshot, version in rows]


# Features a teacher may explore in the what-if simulator, with safe ranges.
# These are the model's own derived aggregates — the simulation perturbs the
# model's inputs, never stored school data.
SIMULATION_FEATURES: dict[str, tuple[float, float]] = {
    "Attendance_Percent": (0, 100),
    "Avg_Score": (0, 100),
    "Assignment_Avg_Score": (0, 100),
    "Quiz_Avg_Score": (0, 100),
    "Late_Submissions": (0, 100),
    "Study_Hours_Weekly": (0, 60),
    "LMS_Active_Days": (0, 56),
}


def simulate_what_if(
    db: Session, teacher: User, data: WhatIfRequest, model: LoadedModel
) -> WhatIfResponse:
    found = db.execute(
        select(RiskPrediction, FeatureSnapshot)
        .join(FeatureSnapshot, FeatureSnapshot.id == RiskPrediction.feature_snapshot_id)
        .where(
            RiskPrediction.school_id == teacher.school_id,
            FeatureSnapshot.school_id == teacher.school_id,
            RiskPrediction.id == data.prediction_id,
        )
    ).one_or_none()
    if found is None:
        raise APIError(404, "PREDICTION_NOT_FOUND", "Prediction not found.")
    row, snapshot = found
    authorized_enrollment(db, teacher, row.student_id, row.course_offering_id)
    if (
        snapshot.feature_version != model.metadata["feature_version"]
        or set(snapshot.features.get("values", {})) != set(model.feature_names)
    ):
        raise APIError(
            409,
            "SNAPSHOT_INCOMPATIBLE",
            "This insight was recorded for a different model feature contract.",
        )
    overrides: dict[str, float] = {}
    for name, value in data.overrides.items():
        if name not in SIMULATION_FEATURES:
            raise APIError(
                422,
                "UNKNOWN_SIMULATION_FEATURE",
                f"'{name}' cannot be simulated. Allowed: {', '.join(sorted(SIMULATION_FEATURES))}.",
            )
        low, high = SIMULATION_FEATURES[name]
        if not low <= value <= high:
            raise APIError(
                422,
                "SIMULATION_VALUE_OUT_OF_RANGE",
                f"'{name}' must be between {low} and {high}.",
            )
        overrides[name] = float(value)
    values = dict(snapshot.features["values"])
    values.update(overrides)
    try:
        result = predict(model, values)
    except (ValueError, TypeError) as exc:
        raise APIError(
            503, "INFERENCE_FAILED", "The model could not process the simulated observations."
        ) from exc
    return WhatIfResponse(
        prediction_id=row.id,
        baseline_probability=float(row.risk_probability),
        baseline_support_level={"low": "doing_well", "medium": "watch", "high": "priority_support"}[
            row.risk_level
        ],
        probability=result["risk_probability"],
        support_level=result["support_level"],
        delta=round(result["risk_probability"] - float(row.risk_probability), 6),
        applied_overrides=overrides,
    )
