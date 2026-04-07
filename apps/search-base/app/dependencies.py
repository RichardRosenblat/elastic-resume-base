"""Dependency injection for the Search Base service."""

from app.services.search_service import SearchService

# Global singleton for the search service
_search_service_instance: SearchService | None = None


def get_search_service() -> SearchService:
    """Get the singleton SearchService instance.

    Returns:
        The initialized SearchService.

    Raises:
        RuntimeError: If the service has not been initialized.
    """
    global _search_service_instance
    if _search_service_instance is None:
        raise RuntimeError("SearchService not initialized")
    return _search_service_instance


def set_search_service(service: SearchService) -> None:
    """Set the singleton SearchService instance.

    Args:
        service: The SearchService instance to register.
    """
    global _search_service_instance
    _search_service_instance = service
