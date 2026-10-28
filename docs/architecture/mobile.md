# Mobile app (`qore_tally`)

> Diagram: [clean architecture layers](../diagrams/images/mobile-clean-architecture.svg)

`apps/mobile` is the Flutter inventory + sales app. Package name `qore_tally`. Feature-first clean architecture.

```
lib/
  main_<flavor>.dart, bootstrap.dart
  core/            config (dart-define), design (Design 1.5 kit), error (exceptions + failures), network (Dio), usecase, utils
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
- **Design**: every screen draws with the Design 1.5 kit in `lib/core/design` (below). No Material `Icons.*`, no hand-rolled colours.

## Design 1.5 kit (`lib/core/design`)

Qorelly's mobile port of web Design V2, so Tally reads as a Qorelly product. Source: `qorelly-mobile/lib/core/design`.

- **Copied unchanged** (re-copy to update): `v15_tokens.dart` (colours, type, radii; `V15.of(context)` resolves dark mode), `v15_theme.dart` (`V15Theme.light()` / `.dark()`), `brand_themes.dart`, `rich/v15_motion.dart`, `rich/v15_pulse_skeleton.dart`.
- **Ported subset**: `v15_widgets.dart` — tray, sheet, section, tile, button, icon button, pill, row, search, notice, page header, tab bar, skeleton / error / message states. Same names and look as qorelly-mobile, without its Riverpod / go_router / offline ties (Tally uses bloc). Port more pieces from there rather than drawing new ones. Import `core/design/v15_widgets.dart`; it re-exports the tokens, theme and icons.
- **Icons**: Phosphor (MIT, `assets/fonts/phosphor`) through `tally_icons.dart`, under qorelly-mobile's `IconsOutline` / `IconsFill` names. Outline everywhere, Fill only for the active tab. (Web uses Solar; mobile follows the Qorelly mobile kit.)
- **Rules carried over**: grey tray holds white sheets; colour only for meaning; sentence case; tabular figures on counts and money; 44 px targets; no FABs. Honest states — pending shows skeletons, a failed read shows `–` and Retry (never `0` or "no items"), the empty state only after a successful empty read.

## Built so far

- **Shell** (`features/home`): after the business loads, three tabs on the floating `V15TabBar` — **Inventory** (default), **Scans**, **Settings**. Switching business (Settings) reloads Inventory.
- **Inventory tab** (`InventoryPage`, `InventoryListCubit` per business): shelf-capture card (*planned* — the key is off until the scan API ships, see the [photo-to-inventory PRD](../prd-photo-to-inventory.md)), name search on the device, Items / Units / Low stock tiles (low = on hand ≤ `reorderPoint`), and the stock list from `GET …/inventory`. Pull to refresh keeps the list on screen. The barcode scanner opens from the header.
- **Scans tab**: *planned* — an honest "no shelf scans yet" until scans exist.
- **Settings tab**: business switcher, account, sign out.

- **Auth**: session restore, sign in, sign up, emailed code, forgot password → code → new password, sign out — on the kit (`core/design/auth_parts.dart`). Sign-up rules (`auth_rules.dart`, `phone.dart`) are copied unchanged from qorelly-mobile. Signing in with an unconfirmed email sends a fresh code. Pushed auth screens are dropped before `AuthBloc` switches to the app (`finishSignIn`). See [auth.md](auth.md) and the [mobile auth sequence](../diagrams/images/auth-mobile-sequence.svg).
- **Business** (`features/business`): loads the user's businesses; `BusinessCubit` holds the selected one. A failed read shows retry, never "no businesses".
- **Onboarding** (no business yet), as mp's: **1. Your business** — name, industry and sub-type from `GET /api/catalog/verticals`; **2. Starter items** — the sub-type's template with up to 2 suggestions each (`…/templates?suggestions=2`, 60 s timeout for the first ~5 s call): keep / swap (sheet) / own product, price and opening stock, then a confirm list, then `POST …/inventory/starter`. Every row is sent, kept or removed, so the catalogue hears each decision. See [onboarding.md](onboarding.md).
- **Barcode scan** (`features/inventory`), API side in [barcode-scan.md](barcode-scan.md):
  1. On open, `ScanCubit` caches the business's inventory on the device (`GET …/inventory`).
  2. Each scan is normalised (12-digit UPC-A → 13-digit EAN, same rule as the API) and resolved **from the cache first** — instant and offline. A miss asks the API (another device may have linked it) and caches the hit.
  3. Unknown barcode → pick the item it belongs to (items without a barcode, searchable) → `PUT …/barcode` → cached, so the next scan is instant. A 409 shows the API's message.
  4. If the inventory can't be loaded, scanning still works through the API.

  `ScanCubit` is a per-business factory (`sl<ScanCubit>(param1: businessId)`). Camera: `mobile_scanner`, product formats only (EAN-13/8, UPC-A/E, Code 128/39); stops while a result shows and when the app goes to the background (qore-inventory's pattern). Permissions: iOS `NSCameraUsageDescription`, Android `CAMERA`. The cache isn't refreshed while the scanner is open.

## Not yet

Photo-to-inventory (capture → review → confirm, Muse search) — see the PRD. Item detail. Release signing (Android keystore, iOS team/profiles). Routing (go_router) now that there are several screens. Persisting the inventory cache between sessions (offline sync). Selling from a scan (POS).
