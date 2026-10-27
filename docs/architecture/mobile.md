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

- **Auth**: session restore, sign in, sign out. See the [mobile auth sequence](../diagrams/images/auth-mobile-sequence.svg).
- **Business** (`features/business`): loads the user's businesses; `BusinessCubit` holds the selected one. No business yet → points to web onboarding. A failed read shows retry, never "no businesses".
- **Barcode scan** (`features/inventory`), API side in [barcode-scan.md](barcode-scan.md):
  1. On open, `ScanCubit` caches the business's inventory on the device (`GET …/inventory`).
  2. Each scan is normalised (12-digit UPC-A → 13-digit EAN, same rule as the API) and resolved **from the cache first** — instant and offline. A miss asks the API (another device may have linked it) and caches the hit.
  3. Unknown barcode → pick the item it belongs to (items without a barcode, searchable) → `PUT …/barcode` → cached, so the next scan is instant. A 409 shows the API's message.
  4. If the inventory can't be loaded, scanning still works through the API.

  `ScanCubit` is a per-business factory (`sl<ScanCubit>(param1: businessId)`). Camera: `mobile_scanner`, product formats only (EAN-13/8, UPC-A/E, Code 128/39); stops while a result shows and when the app goes to the background (qore-inventory's pattern). Permissions: iOS `NSCameraUsageDescription`, Android `CAMERA`. The cache isn't refreshed while the scanner is open.

## Not yet

Release signing (Android keystore, iOS team/profiles). Routing (go_router) now that there are several screens. Persisting the inventory cache between sessions (offline sync). Selling from a scan (POS).
