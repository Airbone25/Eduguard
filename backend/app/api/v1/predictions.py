from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.core.exceptions import APIError
from app.db.session import get_db
from app.ml.model_loader import LoadedModel
from app.models import User
from app.schemas.prediction import (
    ClassPredictionRequest,
    ForecastResponse,
    PredictionRequest,
    PredictionResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.services import forecast_service, prediction_service as service

router = APIRouter(prefix="/teacher", tags=["predictions"])


def current_model(request: Request) -> LoadedModel:
    model = getattr(request.app.state, "model", None)
    if model is None:
        raise APIError(
            503, "MODEL_UNAVAILABLE", "Pretrained model could not be loaded or validated."
        )
    return model


@router.post(
    "/students/{student_id}/predictions", response_model=PredictionResponse, status_code=201
)
def predict_student(
    student_id: UUID,
    data: PredictionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    model: LoadedModel = Depends(current_model),
):
    return service.predict_student(
        db, teacher, student_id, data.course_offering_id, data.as_of_date, model
    )


@router.get("/students/{student_id}/predictions", response_model=list[PredictionResponse])
def predictions(
    student_id: UUID,
    course_offering_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    model: LoadedModel = Depends(current_model),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return service.list_predictions(
        db, teacher, student_id, course_offering_id, limit, offset, model
    )


@router.get("/students/{student_id}/forecast", response_model=ForecastResponse)
def forecast(
    student_id: UUID,
    course_offering_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    model: LoadedModel = Depends(current_model),
):
    return forecast_service.student_forecast(db, teacher, student_id, course_offering_id, model)


@router.post("/predictions/what-if", response_model=WhatIfResponse)
def what_if(
    data: WhatIfRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    model: LoadedModel = Depends(current_model),
):
    return service.simulate_what_if(db, teacher, data, model)


@router.post(
    "/classes/{course_id}/predictions", response_model=list[PredictionResponse], status_code=201
)
def predict_class(
    course_id: UUID,
    data: ClassPredictionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
    model: LoadedModel = Depends(current_model),
):
    return service.predict_class(db, teacher, course_id, data.as_of_date, model)
