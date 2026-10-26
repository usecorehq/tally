import httpx
from fastapi import FastAPI

from .catalog import catalog_client

app = FastAPI(title="tally-train", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    try:
        async with catalog_client() as client:
            res = await client.get("/v1/health")
            catalog = res.json() if res.is_success else {"status": f"http {res.status_code}"}
    except httpx.HTTPError:
        catalog = {"status": "unreachable"}
    return {"status": "ok", "service": "tally-train", "catalog": catalog}
