"""Rate-limiting singleton for the Ingestor Service.

A single :class:`~slowapi.Limiter` instance is shared between :mod:`app.main`
(which configures it from settings) and :mod:`app.routes.ingest` (which
decorates the ``POST /ingest`` handler with it).

Design
------
The limit string (e.g. ``"10/60second"``) is stored in a module-level
:data:`_rate_limit_config` dict so that :func:`app.main.create_app` can update
it from ``Settings`` at app-creation time, **before any requests arrive**.
The route-level callable :func:`get_rate_limit_string` is then called by
SlowAPI at request time to read the (already-configured) value.

This allows the rate limit to be fully driven by config.yaml values
(``INGEST_RATE_LIMIT_MAX_REQUESTS`` / ``INGEST_RATE_LIMIT_WINDOW_SECONDS``)
with no hardcoded defaults outside of this module.
"""

from __future__ import annotations

from slowapi import Limiter  # type: ignore[import-untyped]
from slowapi.util import get_remote_address  # type: ignore[import-untyped]

# Mutable config store — updated by create_app() from Settings before the
# server starts accepting requests.
_rate_limit_config: dict[str, str] = {"limit": "10/60second"}


def get_rate_limit_string() -> str:
    """Return the currently configured rate-limit string.

    Called by SlowAPI at request time (without arguments) so it always reflects
    the value set by :func:`app.main.create_app`.

    Returns:
        A SlowAPI-compatible limit string, e.g. ``"10/60second"``.
    """
    return _rate_limit_config["limit"]


#: Shared Limiter instance — register on ``app.state.limiter`` in
#: :func:`app.main.create_app` so SlowAPI's exception handler can find it.
limiter: Limiter = Limiter(key_func=get_remote_address)
