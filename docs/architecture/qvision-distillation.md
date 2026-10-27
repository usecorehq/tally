# Q Vision distillation (planned)

> Diagram: [distillation flow](../diagrams/images/qvision-distillation-flow.svg) — **planned, not built**

The console is where Core Technologies operators manage Q Vision: upload product images, link them to Qore Catalog products, and run training/distillation in `services/train`. The intended output is a model the mobile app uses for camera-assisted stock capture.

## What exists today

- `apps/console`: login + a home page showing Qore Catalog health.
- `services/train`: FastAPI app with `GET /health` that checks Qore Catalog.
- Nothing stores images, datasets or runs yet.

## Intended flow

1. Operator uploads images in the console.
2. Console calls the API to create dataset/image records (`tally` schema).
3. Operator links images to catalog products (API proxies catalog search).
4. Operator starts a training run; API hands the job to the train service.
5. Train service fetches product metadata, trains/distils, reports status, metrics and the model artifact.

## Open questions (decide before building)

- Image storage: Supabase Storage bucket vs object store elsewhere.
- Job hand-off API → train: HTTP call, queue (Redis/BullMQ like bookmi), or Postgres-backed queue.
- Teacher model and student target (on-device format for Flutter: TFLite / Core ML / ONNX).
- Who may use the console: a role on `auth.users` metadata or a `tally` staff table.
- Where trained models are versioned and how mobile fetches them.
