import json
import logging
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.router import router
from app.core.config import get_settings
from app.core.exceptions import install_error_handlers
from app.ml.model_loader import load_model

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(message)s")
logger = logging.getLogger("eduguard.requests")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = None
    app.state.model_error = None
    try:
        app.state.model = load_model(settings.model_bundle_path, settings.model_metadata_path)
    except Exception as exc:
        # Keep health/docs available; readiness and predictions report the failure.
        app.state.model_error = type(exc).__name__
        logger.error(json.dumps({"event": "model_load_failed", "error_type": type(exc).__name__}))
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
install_error_handlers(app)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = str(uuid4())
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    route = request.scope.get("route")
    logger.info(
        json.dumps(
            {
                "request_id": request_id,
                "user_id": getattr(request.state, "user_id", None),
                "school_id": getattr(request.state, "school_id", None),
                "route": getattr(route, "path", "unmatched"),
                "status_code": response.status_code,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        )
    )
    return response


app.include_router(health_router)
app.include_router(router, prefix=settings.api_v1_prefix)
