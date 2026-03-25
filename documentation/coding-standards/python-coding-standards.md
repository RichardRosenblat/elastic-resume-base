# Python Coding Standards

This document defines the coding standards and best practices for all Python microservices in the Elastic Resume Base project. All contributors must follow these guidelines to ensure consistency, maintainability, and security across the codebase.

---

## Table of Contents

- [Python Coding Standards](#python-coding-standards)
  - [Table of Contents](#table-of-contents)
  - [Language and Runtime](#language-and-runtime)
  - [Style Guide](#style-guide)
  - [Project Structure](#project-structure)
  - [Naming Conventions](#naming-conventions)
  - [Type Hints](#type-hints)
  - [Docstrings and Comments](#docstrings-and-comments)
  - [Error Handling](#error-handling)
  - [Logging](#logging)
  - [Security](#security)
  - [Dependencies](#dependencies)
  - [Testing](#testing)
  - [Linting and Formatting](#linting-and-formatting)
  - [Environment Variables](#environment-variables)
  - [Async Programming](#async-programming)
  - [Database Access](#database-access)

---

## Language and Runtime

- Use **Python 3.11** or higher.
- All services must specify a pinned Python version in their `Dockerfile` (`FROM python:3.11-slim`).
- Do not use end-of-life Python versions.

---

## Style Guide

All Python code must conform to **[PEP 8](https://peps.python.org/pep-0008/)** with the following specifics:

- **Indentation:** 4 spaces. Never use tabs.
- **Line length:** Maximum 100 characters.
- **Blank lines:**
  - 2 blank lines between top-level definitions (functions, classes).
  - 1 blank line between methods within a class.
- **String quotes:** Use double quotes `"` for strings; use single quotes only when the string itself contains double quotes.
- **Import order:** Follow the `isort` convention — standard library, then third-party, then local imports, each group separated by a blank line.

```python
# Good
import os
import sys

from fastapi import FastAPI
from google.cloud import firestore

from app.models import ResumeModel
from app.services import ingestor


# Bad
import os, sys
from app.models import ResumeModel
from fastapi import FastAPI
```

---

## Project Structure

Each Python microservice should follow this structure:

```
service-name/
├── app/
│   ├── __init__.py
│   ├── main.py          # Application entrypoint
│   ├── config.py        # Environment variable loading and validation
│   ├── models/          # Pydantic models / data schemas
│   │   └── __init__.py
│   ├── routers/         # FastAPI routers (one file per resource)
│   │   └── __init__.py
│   ├── services/        # Business logic layer
│   │   └── __init__.py
│   └── utils/           # Shared utility functions
│       └── __init__.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py      # pytest fixtures
│   └── test_*.py        # Test files
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt  # Development/test dependencies
└── .env.example          # Example environment variables
```

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Modules / files | `snake_case` | `resume_parser.py` |
| Packages / directories | `snake_case` | `models/` |
| Functions | `snake_case` | `def extract_resume_data():` |
| Variables | `snake_case` | `resume_id = "abc123"` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES = 3` |
| Classes | `PascalCase` | `class ResumeModel:` |
| Type aliases | `PascalCase` | `EmbeddingVector = list[float]` |
| Private members | `_single_leading_underscore` | `self._cache = {}` |

---

## Type Hints

All functions and methods **must** include type annotations for parameters and return values.

```python
# Good
def get_resume(resume_id: str) -> dict[str, Any] | None:
    ...

async def publish_message(topic: str, payload: dict[str, Any]) -> bool:
    ...


# Bad
def get_resume(resume_id):
    ...
```

- Use `from __future__ import annotations` at the top of each file when needed for forward references.
- Use `Optional[X]` or `X | None` for nullable values (prefer the `X | None` syntax on Python 3.10+).
- Use `Any` from `typing` sparingly; prefer specific types.
- Use `Pydantic` models for API request/response schemas and data validation.

---

## Docstrings and Comments

Follow **[PEP 257](https://peps.python.org/pep-0257/)** for docstrings. Use the **Google docstring style**.

```python
def extract_fields(raw_text: str, model: str = "gemini-1.5-flash") -> dict[str, Any]:
    """Extract structured resume fields from raw text using Vertex AI.

    Args:
        raw_text: The raw resume text to process.
        model: The Vertex AI model to use for extraction.

    Returns:
        A dictionary containing extracted resume fields such as name,
        email, skills, and work experience.

    Raises:
        VertexAIError: If the AI model fails to process the input.
        ValueError: If raw_text is empty or None.
    """
    ...
```

- All public modules, classes, functions, and methods must have a docstring.
- Use inline comments sparingly and only to explain **why**, not **what**.
- Do not leave commented-out code in committed files.

---

## Error Handling

- **Never silently catch exceptions.** Always handle them explicitly or re-raise.
- Use specific exception types rather than bare `except:` or `except Exception:`.
- Define custom exception classes for domain-specific errors.
- Log exceptions with context before re-raising or returning an error response.

```python
# Good
class ResumeNotFoundError(Exception):
    """Raised when a resume cannot be found in Firestore."""


async def fetch_resume(resume_id: str) -> dict[str, Any]:
    try:
        doc = await db.collection("resumes").document(resume_id).get()
    except google.api_core.exceptions.GoogleAPIError as exc:
        logger.error("Firestore fetch failed for resume_id=%s: %s", resume_id, exc)
        raise
    if not doc.exists:
        raise ResumeNotFoundError(f"Resume {resume_id!r} not found.")
    return doc.to_dict()


# Bad
async def fetch_resume(resume_id):
    try:
        doc = db.collection("resumes").document(resume_id).get()
        return doc.to_dict()
    except:
        return None
```

---

## Logging

- Use Python's built-in `logging` module. **Do not use `print()` for application logging.**
- Configure the logger per module using `logging.getLogger(__name__)`.
- Use structured logging with a JSON formatter in production to integrate with Google Cloud Logging.
- Log at appropriate levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.

```python
import logging

logger = logging.getLogger(__name__)


def process_resume(resume_id: str) -> None:
    logger.info("Starting resume processing", extra={"resume_id": resume_id})
    try:
        ...
        logger.info("Resume processing complete", extra={"resume_id": resume_id})
    except Exception as exc:
        logger.error("Resume processing failed", extra={"resume_id": resume_id, "error": str(exc)})
        raise
```

- **Never log PII** (names, email addresses, phone numbers, document content).
- Log resource identifiers (e.g., `resume_id`) rather than the data itself.

---

## Security

- **Never commit secrets, API keys, or credentials** to the repository.
- Load all secrets from environment variables or Google Cloud Secret Manager.
- Validate and sanitize all external inputs using Pydantic models before processing.
- Use parameterized queries — never construct database queries using string concatenation.
- Encrypt PII fields before persisting them to Firestore (via Cloud KMS).
- Always use HTTPS for outbound HTTP requests; never disable SSL verification.

```python
# Good
import httpx

async with httpx.AsyncClient(verify=True) as client:
    response = await client.get(url, headers=headers)


# Bad — NEVER disable SSL verification
async with httpx.AsyncClient(verify=False) as client:
    ...
```

---

## Dependencies

- Pin all dependencies to exact versions in `requirements.txt`.
- Use `pip-compile` (from `pip-tools`) to generate locked `requirements.txt` from `requirements.in`.
- Separate production and development dependencies:
  - `requirements.txt` — production dependencies only
  - `requirements-dev.txt` — testing, linting, and development tools
- Regularly audit dependencies for known vulnerabilities using `pip-audit`.

```
# requirements.txt
fastapi==0.111.0
pydantic==2.7.1
google-cloud-firestore==2.16.0
google-cloud-pubsub==2.21.1
vertexai==1.52.0
uvicorn[standard]==0.29.0
```

---

## Testing

- Use **pytest** as the test runner.
- Aim for a minimum of **80% code coverage** on business logic.
- Use `pytest-asyncio` for testing async functions.
- Use `unittest.mock` or `pytest-mock` to mock external services (Firestore, Pub/Sub, Vertex AI).
- Test files must be named `test_<module_name>.py`.
- Each test function must be named `test_<what_is_being_tested>`.

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.services.ingestor import process_resume


@pytest.mark.asyncio
async def test_process_resume_publishes_to_pubsub():
    with patch("app.services.ingestor.pubsub_client.publish", new_callable=AsyncMock) as mock_publish:
        await process_resume(resume_id="test-123", sheet_url="https://example.com/sheet")
        mock_publish.assert_called_once()


@pytest.mark.asyncio
async def test_process_resume_raises_on_empty_id():
    with pytest.raises(ValueError, match="resume_id cannot be empty"):
        await process_resume(resume_id="", sheet_url="https://example.com/sheet")
```

---

## Linting and Formatting

All Python services must use the following tools (configured in `pyproject.toml`):

| Tool | Purpose | Configuration |
|---|---|---|
| **Ruff** | Linting (replaces Flake8, isort) | `ruff.toml` or `pyproject.toml` |
| **Black** | Code formatting | `pyproject.toml` |
| **mypy** | Static type checking | `mypy.ini` or `pyproject.toml` |

Example `pyproject.toml` configuration:

```toml
[tool.black]
line-length = 100
target-version = ["py311"]

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "W", "UP"]
ignore = []
target-version = "py311"

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true
```

Run all checks before committing:

```bash
black app/ tests/
ruff check app/ tests/
mypy app/
pytest tests/ --cov=app --cov-report=term-missing
```

---

## Environment Variables

- Load all configuration from environment variables using `pydantic-settings`.
- Define a `Settings` class in `app/config.py` to centralize and validate all configuration.
- Never access `os.environ` directly in business logic — always go through the `Settings` instance.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    project_id: str
    pubsub_topic: str
    firestore_collection: str = "resumes"
    vertex_ai_model: str = "gemini-1.5-flash"
    log_level: str = "INFO"


settings = Settings()
```

---

## Async Programming

- Prefer **async/await** for all I/O-bound operations (HTTP calls, database access, Pub/Sub).
- Use `asyncio` and `httpx` for async HTTP requests. Do not use `requests` in async contexts.
- Avoid blocking the event loop with synchronous calls; use `asyncio.to_thread()` for CPU-bound work.
- Use `asyncio.gather()` to execute independent async operations concurrently.

```python
import asyncio
import httpx


async def fetch_multiple_resumes(resume_ids: list[str]) -> list[dict]:
    async with httpx.AsyncClient() as client:
        tasks = [fetch_resume(client, rid) for rid in resume_ids]
        return await asyncio.gather(*tasks)
```

---

## Database Access

- All Firestore interactions must go through a **repository/data access layer** — do not call Firestore directly from routers or business logic.
- Use transactions for multi-document writes to ensure atomicity.
- Never store raw PII in Firestore. Encrypt sensitive fields using Cloud KMS before persisting.
- Always set `timeout` parameters on Firestore operations to avoid indefinite blocking.

```python
class ResumeRepository:
    def __init__(self, db: firestore.AsyncClient) -> None:
        self._db = db

    async def save(self, resume_id: str, data: dict[str, Any]) -> None:
        await self._db.collection("resumes").document(resume_id).set(data)

    async def find_by_id(self, resume_id: str) -> dict[str, Any] | None:
        doc = await self._db.collection("resumes").document(resume_id).get()
        return doc.to_dict() if doc.exists else None
```
