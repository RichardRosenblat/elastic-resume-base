FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy shared Hermes library first (needed for editable install)
COPY shared/hermes /shared/hermes

# Copy requirements and install dependencies
COPY ai-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY ai-worker/app ./app

# Expose the service port
EXPOSE 8080

# Run the FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
