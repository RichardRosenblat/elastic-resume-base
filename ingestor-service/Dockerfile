FROM python:3.11-slim AS builder

WORKDIR /app

# Install build tools
RUN pip install --upgrade pip

# Copy shared Python libraries first so they can be installed as editable packages
COPY shared/hermes /app/shared/hermes
COPY shared/bowltie /app/shared/bowltie
COPY shared/toolbox /app/shared/toolbox

# Install shared libraries
RUN pip install --no-cache-dir -e /app/shared/hermes
RUN pip install --no-cache-dir -e /app/shared/bowltie
RUN pip install --no-cache-dir -e /app/shared/toolbox

# Copy service requirements and install dependencies
COPY ingestor-service/requirements.txt /app/ingestor-service/requirements.txt
RUN pip install --no-cache-dir -r /app/ingestor-service/requirements.txt

# Copy service source code
COPY ingestor-service /app/ingestor-service

WORKDIR /app/ingestor-service

# ---- Production stage ----
FROM python:3.11-slim AS runner

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy shared libraries (needed for editable installs)
COPY --from=builder /app/shared /app/shared

# Copy service source
COPY --from=builder /app/ingestor-service /app/ingestor-service

WORKDIR /app/ingestor-service

ENV PYTHONUNBUFFERED=1
ENV LOG_FORMAT=json

EXPOSE 8001

# Run as non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "server.py"]
