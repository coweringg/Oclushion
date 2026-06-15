from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)

def test_health_reports_detector_boundary_readiness() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "sano-shield-pii-service",
        "status": "ok",
        "version": "1.0.0",
    }

def test_analysis_detects_pii_without_returning_original_values() -> None:
    response = client.post(
        "/v1/analyze",
        json={
            "requestId": "request-1",
            "text": "Soy Juan Pérez, escribe a juan@example.com y usa sk-proj-abcdefghijklmnop.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["requestId"] == "request-1"
    assert payload["engine"] == "builtin-regex-v1"
    assert {item["type"] for item in payload["detections"]} == {"person", "email", "api_key"}
    assert "juan@example.com" not in response.text

def test_analysis_detects_luhn_valid_payment_cards_only() -> None:
    response = client.post(
        "/v1/analyze",
        json={"requestId": "request-2", "text": "Tarjeta 4242 4242 4242 4242, prueba 1111 1111 1111 1111."},
    )

    detections = response.json()["detections"]
    assert [item["type"] for item in detections] == ["payment_card"]
    detected = detections[0]
    text = "Tarjeta 4242 4242 4242 4242, prueba 1111 1111 1111 1111."
    assert text[detected["start"] : detected["end"]] == "4242 4242 4242 4242"
