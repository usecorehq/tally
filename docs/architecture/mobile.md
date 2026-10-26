# Mobile app (`qore_tally`)

> Diagram: [clean architecture layers](../diagrams/images/mobile-clean-architecture.svg)

`apps/mobile` is the Flutter inventory + sales app. Package name `qore_tally`. Feature-first clean architecture.

```
lib/
  core/            config (dart-define), error (exceptions + failures), network (Dio), usecase
  features/<feature>/
    data/          datasources, models, repository implementations
    domain/        entities, repository contracts, use cases — pure Dart
    presentation/  bloc/, cubit/, pages/
  injection_container.dart
```

## Rules

- **Dependencies point inward.** presentation → domain ← data. Domain imports no Flutter, Supabase or Dio.
- **Errors are values.** Data sources throw `ServerException` / `AuthException`; repositories catch and return `Left(Failure)`; everything above sees `Either<Failure, T>` (dartz). Nothing above the repository catches.
- **Use cases are one action each**, `call(Params)`. Params extend `Equatable`; use `NoParams` when there are none.
- **Bloc vs cubit.** Bloc for app-level, event-driven flows (session: `AuthBloc`). Cubit for screen-local state (forms: `SignInCubit`).
- **get_it.** External clients, data sources, repositories and use cases are lazy singletons; blocs and cubits are factories so each page gets a fresh instance.
- **Config** comes from `--dart-define` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TALLY_API_URL`). Only public values.
- **Tests** mirror `lib/` under `test/`, using `mocktail` and `bloc_test`.

## Built so far

Auth only: session restore, sign in, sign out, home placeholder. See the [mobile auth sequence](../diagrams/images/auth-mobile-sequence.svg).

## Not yet

Platform folders (`android/`, `ios/`) — generate with `flutter create` (see `apps/mobile/README.md`). Routing (go_router) once there is more than one authenticated screen. Offline inventory sync.
