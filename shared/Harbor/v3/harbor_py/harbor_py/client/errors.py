"""Error detection utilities for HarborClient v3."""

from __future__ import annotations

import httpx


def is_harbor_error(err: BaseException) -> bool:
    """Return ``True`` if *err* originated from a :class:`HarborClient` request.

    Use this guard in ``except`` blocks to distinguish network-level and HTTP
    errors raised by :class:`~harbor_py.HarborClient` (wrapping ``httpx``)
    from other unexpected exceptions before mapping them to domain-specific
    error types.

    Args:
        err: The exception to inspect.

    Returns:
        ``True`` if *err* is an ``httpx``-level error, ``False`` otherwise.

    Example::

        from harbor_py import is_harbor_error
        import httpx

        try:
            response = await client.post("/endpoint", json=payload)
            response.raise_for_status()
        except BaseException as err:
            if is_harbor_error(err):
                if isinstance(err, httpx.TimeoutException):
                    raise UnavailableError("Service timed out") from err
                raise DownstreamError("Unexpected response") from err
            raise
    """
    return isinstance(err, httpx.HTTPError)
