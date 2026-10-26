# services/train

Q Vision distillation service — pulls product data from the Qore Catalog API
and trains image models on uploads managed in apps/console.

```bash
uv sync
uv run uvicorn train.main:app --reload --port 4200
uv run pytest
```
