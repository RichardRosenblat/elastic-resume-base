"""HarborManager — registry and lifecycle manager for HarborClient instances.

``HarborManager`` allows you to register, retrieve, and manage the lifecycle
of multiple named :class:`~harbor_py.HarborClient` objects in a centralised
place.  This is especially useful in service bootstrapping code where you need
to create several downstream clients once and then inject them into service-
specific objects later.

Example::

    from harbor_py import HarborManager, HarborClientOptions

    manager = HarborManager()

    # Register clients during startup:
    manager.register_client("users", HarborClientOptions(base_url="http://users-api:8005"))
    manager.register_client("search", HarborClientOptions(base_url="http://search:8002"))

    # Retrieve anywhere:
    users_client = manager.get_client("users")
"""

from __future__ import annotations

from harbor_py.client.harbor_client import HarborClient, HarborClientOptions


class HarborManager:
    """Registry and lifecycle manager for :class:`HarborClient` instances.

    Attributes are intentionally private; interact through the public API methods.
    """

    def __init__(self) -> None:
        self._clients: dict[str, HarborClient] = {}

    def register_client(self, key: str, options: HarborClientOptions) -> HarborClient:
        """Register (or replace) a :class:`HarborClient` under *key*.

        Args:
            key: A unique identifier for this client (e.g. ``"users"``).
            options: Configuration options forwarded to :class:`HarborClient`.

        Returns:
            The newly created :class:`HarborClient` instance.
        """
        client = HarborClient(options)
        self._clients[key] = client
        return client

    def get_client(self, key: str) -> HarborClient | None:
        """Return the :class:`HarborClient` registered under *key*, or ``None``.

        Args:
            key: The key used when the client was registered.
        """
        return self._clients.get(key)

    def has_client(self, key: str) -> bool:
        """Return ``True`` if a client is registered under *key*.

        Args:
            key: The key to check.
        """
        return key in self._clients

    def unregister_client(self, key: str) -> bool:
        """Remove the client registered under *key*.

        Args:
            key: The key of the client to remove.

        Returns:
            ``True`` if the client existed and was removed, ``False`` otherwise.
        """
        if key in self._clients:
            del self._clients[key]
            return True
        return False

    def clear(self) -> None:
        """Remove all registered clients."""
        self._clients.clear()

    @property
    def registered_keys(self) -> list[str]:
        """All keys for which a client is currently registered."""
        return list(self._clients.keys())

    @property
    def size(self) -> int:
        """Total number of registered clients."""
        return len(self._clients)
