"""HarborClient server-side subpackage (v3).

Re-exports all client-side symbols and adds IAM-authenticated and
environment-aware clients for service-to-service calls on Google Cloud Platform.
"""

from harbor_py.client import (
    IHarborClient,
    HarborClient,
    HarborClientOptions,
    HarborManager,
    is_harbor_error,
)
from harbor_py.server.iam_harbor_client import IamHarborClient, IamHarborClientOptions
from harbor_py.server.server_harbor_client import ServerHarborClient, ServerHarborClientOptions

__all__ = [
    # client re-exports
    "IHarborClient",
    "HarborClient",
    "HarborClientOptions",
    "HarborManager",
    "is_harbor_error",
    # server — IAM-authenticated
    "IamHarborClient",
    "IamHarborClientOptions",
    # server — environment-aware
    "ServerHarborClient",
    "ServerHarborClientOptions",
]
