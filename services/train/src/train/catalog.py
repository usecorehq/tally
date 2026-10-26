import httpx

from .config import settings


def catalog_client() -> httpx.AsyncClient:
    """Qore Catalog API client. Its global ApiKeyGuard reads x-api-key."""
    return httpx.AsyncClient(
        base_url=settings.qore_catalog_base_url,
        headers={"x-api-key": settings.qore_catalog_api_key},
        timeout=10,
    )
