from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app


def test_health_and_docs():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/docs").status_code == 200
        assert client.get("/openapi.json").status_code == 200


def test_ready_database_failure():
    class BrokenDB:
        def execute(self, statement):
            raise OperationalError("", {}, Exception("private connection details"))

    app.dependency_overrides[get_db] = lambda: BrokenDB()
    try:
        with TestClient(app) as client:
            response = client.get("/ready")
            assert response.status_code == 503
            assert "private" not in response.text
    finally:
        app.dependency_overrides.clear()
