from fastapi.testclient import TestClient

from train.main import app


def test_health_reports_service():
    body = TestClient(app).get("/health").json()
    assert body["status"] == "ok"
    assert body["service"] == "tally-train"
    assert "catalog" in body
