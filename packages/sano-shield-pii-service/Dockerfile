# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS builder
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
WORKDIR /build
RUN python -m venv "$VIRTUAL_ENV"
COPY packages/sano-shield-pii-service/pyproject.toml ./pyproject.toml
COPY packages/sano-shield-pii-service/src ./src
RUN pip install --no-cache-dir .

FROM python:3.12-slim AS runtime
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /service
RUN groupadd --system --gid 1001 oclushion && useradd --system --uid 1001 --gid oclushion pii
COPY --from=builder --chown=pii:oclushion /opt/venv /opt/venv
COPY --chown=pii:oclushion packages/sano-shield-pii-service/src ./src
USER pii
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/health')"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8081", "--no-access-log"]
