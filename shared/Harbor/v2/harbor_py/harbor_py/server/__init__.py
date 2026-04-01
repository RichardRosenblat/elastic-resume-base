"""HarborClient server-side subpackage.

Re-exports all client-side symbols and adds IAM-authenticated client
for service-to-service calls on Google Cloud Platform.
"""

from harbor_py.client import HarborClient, HarborClientOptions, create_harbor_client, is_harbor_error
from harbor_py.server.iam import IamHarborClient, IamHarborClientOptions, create_iam_harbor_client

__all__ = [
    "HarborClient",
    "HarborClientOptions",
    "create_harbor_client",
    "is_harbor_error",
    "IamHarborClient",
    "IamHarborClientOptions",
    "create_iam_harbor_client",
]
