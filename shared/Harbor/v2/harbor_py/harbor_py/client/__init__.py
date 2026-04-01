"""HarborClient browser-safe client subpackage.

Exports the basic HTTP client factory and related types. Contains no
server-side logic (no IAM authentication, no service-account credentials).
"""

from harbor_py.client.http_client import HarborClient, HarborClientOptions, create_harbor_client
from harbor_py.client.errors import is_harbor_error

__all__ = [
    "HarborClient",
    "HarborClientOptions",
    "create_harbor_client",
    "is_harbor_error",
]
