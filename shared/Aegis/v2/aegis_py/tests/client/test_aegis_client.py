"""Tests for Aegis Python client subpackage.

Python services are always server-side. The aegis_py.client subpackage exists
for structural symmetry but contains no client modules. For browser
authentication, use ``@elastic-resume-base/aegis/client`` (TypeScript).
"""


def test_client_subpackage_exists() -> None:
    """The aegis_py.client subpackage should be importable."""
    import aegis_py.client  # noqa: F401
