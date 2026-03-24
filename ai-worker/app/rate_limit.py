"""slowapi limiter singleton — shared by main.py and all routers.

Centralising the Limiter here avoids circular imports between main.py and
the router modules that apply ``@limiter.limit(...)`` decorators.
"""

from __future__ import annotations

from slowapi import Limiter  # type: ignore[attr-defined]
from slowapi.util import get_remote_address  # type: ignore[attr-defined]

#: Shared limiter instance. Rate-limit key: source IP address.
limiter = Limiter(key_func=get_remote_address)
