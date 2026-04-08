"""HarborClient browser-safe client subpackage (v3).

Exports the object-oriented :class:`HarborClient` class, the :class:`IHarborClient`
interface, the :class:`HarborManager` registry, and error utilities.
"""

from harbor_py.client.harbor_client import HarborClient, HarborClientOptions, IHarborClient
from harbor_py.client.harbor_manager import HarborManager
from harbor_py.client.errors import is_harbor_error

__all__ = [
    "IHarborClient",
    "HarborClient",
    "HarborClientOptions",
    "HarborManager",
    "is_harbor_error",
]
