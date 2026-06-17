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
    detections.extend(detect_email(text))
    detections.extend(detect_phone(text))
    detections.extend(detect_regex(text, "api_key", r"\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b"))
    detections.extend(detect_regex(text, "access_token", r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"))
    detections.extend(detect_regex(text, "private_key", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"))
    detections.extend(detect_person_names(text))
    return remove_overlaps(detections)

def detect_email(text: str) -> list[Detection]:
    pattern = re.compile(r"\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}\b")
    return [
        Detection(type="email", start=m.start(), end=m.end(), confidence=1.0)
        for m in pattern.finditer(text)
    ]

PHONE_PLUS_RE = re.compile(r"\+\d[\d\s.-]{6,20}(?!\d)(?![\d\s.-])")
PHONE_WORD_RE = re.compile(r"(?:tel(?:éfono)?|phone)[\s:.]{0,10}[\d\s.-]{7,20}(?!\d)(?![\d\s.-])", re.IGNORECASE)

def detect_phone(text: str) -> list[Detection]:
    if len(text) > 5000:
        return []
    detections: list[Detection] = []
    for m in PHONE_PLUS_RE.finditer(text):
        digits = sum(1 for c in m.group() if c.isdigit())
        if 8 <= digits <= 16:
            detections.append(Detection(type="phone", start=m.start(), end=m.end(), confidence=1.0))
    for m in PHONE_WORD_RE.finditer(text):
        digits = sum(1 for c in m.group() if c.isdigit())
        if 7 <= digits <= 14:
            detections.append(Detection(type="phone", start=m.start(), end=m.end(), confidence=1.0))
    return detections

def detect_regex(text: str, entity_type: EntityType, pattern: str) -> list[Detection]:
    if len(text) > 5000:
        return []
    return [
        Detection(type=entity_type, start=match.start(), end=match.end(), confidence=1.0)
        for match in re.finditer(pattern, text)
    ]

def detect_person_names(text: str) -> list[Detection]:
    if len(text) > 5000:
        return []
    pattern = re.compile(
        r"\b(?:soy|nombre\s{0,10}es|cliente\s{0,10}:\s{0,10})\s{1,10}"
        r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,50}(?:\s{1,10}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,50}){1,20})(?:\W|$)",
        re.IGNORECASE,
    )
    return [
        Detection(type="person", start=match.start(1), end=match.end(1), confidence=0.85)
        for match in pattern.finditer(text)
    ]

CC_RE = re.compile(r"(?<!\d)\d[\d\s.-]{12,20}(?!\d)(?![\d\s.-])")

def detect_payment_cards(text: str) -> list[Detection]:
    if len(text) > 5000:
        return []
    detections: list[Detection] = []
    for m in CC_RE.finditer(text):
        digits = sum(1 for c in m.group() if c.isdigit())
        if 13 <= digits <= 19 and passes_luhn(m.group()):
            detections.append(Detection(type="payment_card", start=m.start(), end=m.end(), confidence=1.0))
    return detections

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
