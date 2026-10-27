# Mobile app (`qore_tally`)

> Diagram: [clean architecture layers](../diagrams/images/mobile-clean-architecture.svg)

`apps/mobile` is the Flutter inventory + sales app. Package name `qore_tally`. Feature-first clean architecture.

```
lib/
  main_<flavor>.dart, bootstrap.dart
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
- **Flavors** `dev`, `staging`, `prod` — one `lib/main_<flavor>.dart` each, sharing `bootstrap.dart`. Each installs side by side (`com.qorelly.tally[.dev|.staging]`). Design and gotchas: [mobile-flavors.md](mobile-flavors.md); how to run and add one: [apps/mobile/README.md](../../apps/mobile/README.md#flavors).
- **Config**: the flavor sets `apiBaseUrl`; `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (legacy anon key also accepted) and `TALLY_API_URL` come from `--dart-define-from-file=.env.<flavor>` (gitignored, same layout as qore-mobile). Only public values.
- **Tests** mirror `lib/` under `test/`, using `mocktail` and `bloc_test`.

## Built so far

Auth only: session restore, sign in, sign out, home placeholder. See the [mobile auth sequence](../diagrams/images/auth-mobile-sequence.svg).

## Not yet

Release signing (Android keystore, iOS team/profiles). Routing (go_router) once there is more than one authenticated screen. Offline inventory sync.
