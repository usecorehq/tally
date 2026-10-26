# qore_tally (apps/mobile)

Flutter inventory + sales app. Clean architecture, feature-first:

```
lib/
  core/            config (dart-define), error (Exception → Failure), network (Dio → apps/api), usecase
  features/<name>/
    data/          datasources, models, repository impls (catch exceptions → Left(Failure))
    domain/        entities, repository contracts, use cases (Either<Failure, T>)
    presentation/  bloc (app-level flows), cubit (screen-local state), pages
  injection_container.dart   get_it wiring
```

Auth is the shared Qorelly Supabase Auth; the access token is sent to apps/api as a Bearer header.

Platform folders (android/, ios/) are not committed yet — generate them once:

```bash
flutter create --org ng.qorelly --project-name qore_tally --platforms=android,ios .
```

Run:

```bash
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=... --dart-define=TALLY_API_URL=http://localhost:4100/api
```
