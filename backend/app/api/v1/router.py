from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboards import router as dashboard_router
from app.api.v1.imports import router as import_router
from app.api.v1.interventions import router as intervention_router
from app.api.v1.management import router as management_router
from app.api.v1.predictions import router as prediction_router
from app.api.v1.students import router as student_router
from app.api.v1.teachers import router as teacher_router
from app.api.v1.templates import router as template_router
from app.api.v1.weekly_records import router as weekly_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(management_router)
router.include_router(teacher_router)
router.include_router(dashboard_router)
router.include_router(student_router)
router.include_router(weekly_router)
router.include_router(prediction_router)
router.include_router(intervention_router)
router.include_router(import_router)
router.include_router(template_router)
