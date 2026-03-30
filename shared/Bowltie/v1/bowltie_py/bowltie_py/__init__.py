"""Bowltie — standard API response formatting for Elastic Resume Base Python services.

Mirrors the TypeScript ``@elastic-resume-base/bowltie`` package so that all
Python services emit identical JSON envelopes to the Node.js services,
regardless of implementation language.

Quick start::

    from bowltie_py import format_success, format_error
    from fastapi.responses import JSONResponse

    # In a FastAPI router:
    return JSONResponse(format_success({"id": "123"}))
    return JSONResponse(format_error("NOT_FOUND", "Resume not found"), status_code=404)
"""

from bowltie_py.response import format_error, format_success

__all__ = [
    "format_success",
    "format_error",
]
