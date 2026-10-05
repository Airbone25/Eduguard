from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.ml.inference import ordered_features, predict
from app.ml.model_loader import LoadedModel
from app.models import CourseOffering, FeatureSnapshot, ModelVersion, RiskPrediction, Subject, User
from app.schemas.prediction import PredictionResponse
from app.services.common import audit, tenant_row, transaction
from app.services.explanation_service import explanation_signals
from app.services.feature_service import build_student_features
from app.services.recommendation_service import recommend
from app.services.teacher_service import list_students
from app.services.weekly_record_service import authorized_enrollment


def registered_version(db: Session, model: LoadedModel) -> ModelVersion:
    meta = model.metadata
    db.execute(
        insert(ModelVersion)
        .values(
            name=meta["model_name"],
            version=meta["model_version"],
            artifact_path=model.artifact_path,
            artifact_sha256=meta["artifact_sha256"],
            feature_version=meta["feature_version"],
            thresholds=meta["thresholds"],
            metrics={},
            is_active=True,
        )
        .on_conflict_do_nothing()
    )
    version = db.scalar(
        select(ModelVersion).where(
            ModelVersion.name == meta["model_name"],
            ModelVersion.version == meta["model_version"],
        )
    )
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
    row: RiskPrediction, snapshot: FeatureSnapshot, version: ModelVersion
) -> PredictionResponse:
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
    return response(row, snapshot, version)


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
    db: Session, teacher: User, student_id: UUID, course_id: UUID, limit: int, offset: int
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
    return [response(row, snapshot, version) for row, snapshot, version in rows]
