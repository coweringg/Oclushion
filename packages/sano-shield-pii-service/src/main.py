import re
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    service: str
    status: Literal["ok"]
    version: str

class AnalyzeRequest(BaseModel):
    request_id: str = Field(alias="requestId", min_length=1)
    text: str
    languages: list[str] = Field(default_factory=lambda: ["es", "en"])

EntityType = Literal[
    "person",
    "email",
    "phone",
    "payment_card",
    "bank_account",
    "api_key",
    "access_token",
    "private_key",
]

class Detection(BaseModel):
    type: EntityType
    start: int
    end: int
    confidence: float

class AnalyzeResponse(BaseModel):
    request_id: str = Field(serialization_alias="requestId")
    engine: str
    detections: list[Detection]

app = FastAPI(title="Oclushion Sano Shield PII Service", version="1.0.0")

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(service="sano-shield-pii-service", status="ok", version="1.0.0")

@app.post("/v1/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    return AnalyzeResponse(
        request_id=request.request_id,
        engine="builtin-regex-v1",
        detections=detect_entities(request.text),
    )

def detect_entities(text: str) -> list[Detection]:
    detections: list[Detection] = []
    detections.extend(detect_payment_cards(text))
    detections.extend(detect_regex(text, "email", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"))
    detections.extend(
        detect_regex(
            text,
            "phone",
            r"(?:(?<!\d)\+\d{1,3}[\s.-]?(?:\d[\s.-]?){7,13}\d(?!\d)|"
            r"\b(?:tel(?:éfono)?|phone)\s*[:.]?\s*(?:\d[\s.-]?){7,13}\d(?!\d))",
        )
    )
    detections.extend(detect_regex(text, "api_key", r"\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b"))
    detections.extend(detect_regex(text, "access_token", r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"))
    detections.extend(detect_regex(text, "private_key", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"))
    detections.extend(detect_person_names(text))
    return remove_overlaps(detections)

def detect_regex(text: str, entity_type: EntityType, pattern: str) -> list[Detection]:
    return [
        Detection(type=entity_type, start=match.start(), end=match.end(), confidence=1.0)
        for match in re.finditer(pattern, text)
    ]

def detect_person_names(text: str) -> list[Detection]:
    pattern = re.compile(
        r"\b(?:soy|nombre\s+es|cliente\s*:\s*)\s+"
        r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)",
        re.IGNORECASE,
    )
    return [
        Detection(type="person", start=match.start(1), end=match.end(1), confidence=0.85)
        for match in pattern.finditer(text)
    ]

def detect_payment_cards(text: str) -> list[Detection]:
    candidates = re.finditer(r"(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)", text)
    return [
        Detection(type="payment_card", start=match.start(), end=match.end(), confidence=1.0)
        for match in candidates
        if passes_luhn(match.group())
    ]

def passes_luhn(candidate: str) -> bool:
    digits = [int(character) for character in candidate if character.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        adjusted = digit * 2 if index % 2 == parity else digit
        checksum += adjusted - 9 if adjusted > 9 else adjusted
    return checksum % 10 == 0

def remove_overlaps(detections: list[Detection]) -> list[Detection]:
    accepted: list[Detection] = []
    for detection in sorted(detections, key=lambda item: (item.start, -item.confidence)):
        overlaps = any(
            detection.start < prior.end and detection.end > prior.start for prior in accepted
        )
        if not overlaps:
            accepted.append(detection)
    return accepted
