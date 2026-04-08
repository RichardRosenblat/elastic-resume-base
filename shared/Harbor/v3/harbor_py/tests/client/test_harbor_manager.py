"""Unit tests for HarborManager (v3)."""

from __future__ import annotations

from harbor_py.client import HarborClient, HarborClientOptions, HarborManager


# ─── register_client ──────────────────────────────────────────────────────────


def test_register_client_returns_harbor_client() -> None:
    manager = HarborManager()
    client = manager.register_client("users", HarborClientOptions(base_url="http://users:8005"))
    assert isinstance(client, HarborClient)


def test_register_client_stores_under_key() -> None:
    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://users:8005"))
    assert manager.has_client("users")


def test_register_client_applies_options() -> None:
    manager = HarborManager()
    client = manager.register_client(
        "search", HarborClientOptions(base_url="http://search:8002", timeout_seconds=5.0)
    )
    assert str(client._client.base_url) == "http://search:8002"
    assert client._client.timeout.read == 5.0


def test_register_client_replaces_existing() -> None:
    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://old:8000"))
    new_client = manager.register_client("users", HarborClientOptions(base_url="http://new:8005"))
    assert manager.get_client("users") is new_client
    assert manager.size == 1


def test_register_client_creates_independent_instances() -> None:
    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://users:8005"))
    manager.register_client("search", HarborClientOptions(base_url="http://search:8002"))
    users = manager.get_client("users")
    search = manager.get_client("search")
    assert users is not None and search is not None
    assert str(users._client.base_url) != str(search._client.base_url)


# ─── get_client ───────────────────────────────────────────────────────────────


def test_get_client_returns_registered_client() -> None:
    manager = HarborManager()
    registered = manager.register_client("users", HarborClientOptions(base_url="http://users"))
    retrieved = manager.get_client("users")
    assert retrieved is registered


def test_get_client_returns_none_for_unknown_key() -> None:
    manager = HarborManager()
    assert manager.get_client("unknown") is None


# ─── has_client ───────────────────────────────────────────────────────────────


def test_has_client_true_when_registered() -> None:
    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://users"))
    assert manager.has_client("users") is True


def test_has_client_false_when_not_registered() -> None:
    manager = HarborManager()
    assert manager.has_client("missing") is False


# ─── unregister_client ────────────────────────────────────────────────────────


def test_unregister_client_removes_and_returns_true() -> None:
    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://users"))
    result = manager.unregister_client("users")
    assert result is True
    assert manager.has_client("users") is False


def test_unregister_client_returns_false_for_missing_key() -> None:
    manager = HarborManager()
    assert manager.unregister_client("missing") is False


# ─── clear ────────────────────────────────────────────────────────────────────


def test_clear_removes_all_clients() -> None:
    manager = HarborManager()
    manager.register_client("a", HarborClientOptions(base_url="http://a"))
    manager.register_client("b", HarborClientOptions(base_url="http://b"))
    manager.clear()
    assert manager.size == 0
    assert manager.registered_keys == []


# ─── registered_keys and size ─────────────────────────────────────────────────


def test_registered_keys_returns_all_keys() -> None:
    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://users"))
    manager.register_client("search", HarborClientOptions(base_url="http://search"))
    assert set(manager.registered_keys) == {"users", "search"}


def test_size_reflects_current_count() -> None:
    manager = HarborManager()
    assert manager.size == 0
    manager.register_client("a", HarborClientOptions(base_url="http://a"))
    assert manager.size == 1
    manager.register_client("b", HarborClientOptions(base_url="http://b"))
    assert manager.size == 2
    manager.unregister_client("a")
    assert manager.size == 1
