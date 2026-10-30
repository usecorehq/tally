# Mobile app (`qore_tally`)

> Diagram: [clean architecture layers](../diagrams/images/mobile-clean-architecture.svg)

`apps/mobile` is the Flutter stock-taking app. Package name `qore_tally`. Feature-first clean architecture.

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
- **Icons**: Phosphor (MIT, `assets/fonts/phosphor`) through `tally_icons.dart`, under qorelly-mobile's `IconsOutline` / `IconsFill` names. Outline everywhere, Fill only for the active tab. (Web draws Phosphor too, through `@tally/ui`'s Solar-named `SolarIcon`.)
- **Rules carried over**: grey tray holds white sheets; colour only for meaning; sentence case; tabular figures on counts and money; 44 px targets; no FABs. Honest states — pending shows skeletons, a failed read shows `–` and Retry (never `0` or "no items"), the empty state only after a successful empty read.

## Built so far

- **Shell** (`features/home`): after the business loads, three tabs on the floating `V15TabBar` — **Inventory** (default), **Scans**, **Settings**. Switching business (Settings) reloads Inventory.
- **Inventory tab** (`InventoryPage`, `InventoryListCubit` per business): shelf-capture card (opens photo-to-inventory, below), name search on the device, Items / Units / Low stock tiles (low = on hand ≤ `reorderPoint`), and the stock list from `GET …/inventory`. Pull to refresh keeps the list on screen. The barcode scanner opens from the header.
- **Scans tab**: *planned* — an honest "no shelf scans yet" until scans exist.
- **Settings tab**: business switcher, account, sign out.

- **Auth**: session restore, sign in, sign up, emailed code, forgot password → code → new password, sign out — on the kit (`core/design/auth_parts.dart`). Sign-up rules (`auth_rules.dart`, `phone.dart`) are copied unchanged from qorelly-mobile. Signing in with an unconfirmed email sends a fresh code. Pushed auth screens are dropped before `AuthBloc` switches to the app (`finishSignIn`). See [auth.md](auth.md) and the [mobile auth sequence](../diagrams/images/auth-mobile-sequence.svg).
- **Business** (`features/business`): loads the user's businesses; `BusinessCubit` holds the selected one. A failed read shows retry, never "no businesses".
- **Onboarding** (no business yet), as mp's: **1. Your business** — name, industry and sub-type from `GET /api/catalog/verticals`; **2. Starter items** — the sub-type's template with up to 2 suggestions each (`…/templates?suggestions=2`, 60 s timeout for the first ~5 s call): keep / swap (sheet) / own product, price and opening stock, then a confirm list, then `POST /api/businesses` and `POST …/inventory/starter`. Step 1 only collects a `BusinessDraft`; nothing is created until step 2 finishes or is skipped, so Back can change the name and type. Every row is sent, kept or removed, so the catalogue hears each decision. See [onboarding.md](onboarding.md).
- **Photo-to-inventory** (`features/stocktake`, PRD S2–S5; API side in [vision-recognition.md](vision-recognition.md) and [stocktake-agent.md](stocktake-agent.md)). Diagram: [mobile stock-take](../diagrams/images/mobile-stocktake-sequence.svg). The same flow as mp's `/stocktake`, and the same confirm body (`scan_review.dart` is a port of mp's review table, with tests):
  1. **Capture** (`ShelfScanPage`): take a photo or pick one (`image_picker`, scaled to a 2560 px long edge as mp, so small products keep a usable crop; JPEG 80; ≤ 4 MB checked before upload).
     **Photo check** (`PhotoCheckCubit`, once per photo; [vision-recognition.md](vision-recognition.md)): the phone's own checks first, on a 320 px RGBA copy decoded with `dart:ui` (dark: mean luminance < 60; blurry: Laplacian variance < 40; glare: > 8% of pixels ≥ 250; `photo_quality.dart`, tested), then `CheckPhoto` (`POST …/vision/photo-check`) on a copy under 1 MB. `dart:ui` can't encode JPEG and no image package is added, so the copy is a 1024 px PNG, else 768 px, else the picked JPEG itself when it's ≤ 1 MB; if none fits the model check is skipped. Under the photo: "Checking the photo with Muse Spark…", then a verdict pill (Good photo / Usable, could be better / Retake recommended), the model's and the phone's issues in plain words, "~N products · labels mostly readable", the instruction when not good and **Retake photo** on a retake verdict. A failed check shows nothing unless the phone found something (one amber line). Advice only: the scan buttons never wait on it. A photo under 1500 px on its long edge gets mp's small-photo warning.
  2. **Scan**: **Start stock-take** (the agent: `POST …/vision/stocktakes`, then `GET …/stocktakes/:runId` every 1.5 s with its live step trace, giving up after 6 min) or **Quick scan** (`POST …/vision/shelf-scans`, one request, ~15–30 s). Which is the default is still open (stock-take-agent.md, *Planned*), so both are offered, as on the web. Cancel drops the reply and keeps the photo. `ShelfScanCubit` per business.
  3. **Review** (`ScanReviewView`, `ScanReviewCubit` per scan): the photo with every counted unit outlined (tap one to find its line), then a line per undecided product: a thumbnail cut from the photo, what was read, the store status ("In store", "Is this your X?", "You removed X. Restore?", "Not in store"), a confidence pill, the agent's flag, the action (restock / restore / add / skip), a count stepper, the product picker and, when adding, name and price prefilled from the match's indicative price. A restock or restore of a matched item shows the store item's name instead of a picker. Nothing is stocked until **Stock N items, U units**; every line is sent, skipped ones too, so the catalogue hears each decision. The footer counts only the actions in use, plus "N to choose".
     The review rules match mp's review table and [Showing a line](vision-recognition.md#showing-a-line-clients) (`scan_review.dart`, tested): a low top match or an agent `review` reason picks nothing (the merchant chooses a product or "New item"); a medium pick on a line not in store asks "Is this your item?"; a restock or restore that asks "Is this your item?", or is flagged and wasn't matched by a remembered reading, starts with no action ("Choose restock, add or skip"), and confirm waits for it. Choosing "New item" clears a price that came from the previous product. Lines confirmed earlier (a partial confirm) are hidden, with a note saying how many.
     **Product picker** (`showProductPicker`, `ProductPickerCubit` per sheet; as mp's product-picker): **Suggested** (the line's candidates with the catalogue picture, else the line's crop; size, "~₦median" and a Strong / Medium / Low match pill), **Other sizes** of the current pick (`GET /api/catalog/products/:qid` when the sheet opens, its variants minus the pick), **Search the catalogue** (`GET /api/catalog/products?q=&limit=10`, 300 ms debounce, 2+ characters, only the latest answer counts) and **New item**. Picking another size or a search hit fetches that product (a merged one is followed once) and sets its name, and its median price when it has one (`ScanReviewCubit.chooseCatalogueProduct`). The catalogue calls are `SearchCatalogue` / `GetCatalogueProduct` over the signed-in API (the catalogue key stays server-side).
     **Coverage** (`coverage.dart`, tested; as mp's coverage.ts): the photo is a 3 × 3 grid on the 0–1000 box scale; a cell is unread when no box of an undecided line touches it. With 2+ unread cells (and some lines), the list view's photo shades them (35% black, dashed amber border) and the review warns "Nothing was read in parts of this photo (shaded: top left, centre, …). If there are products there, take a closer photo of those shelves."
     The review renders from the photo just taken or, for a reopened scan, the stored `photoUrl`: a presigned R2 link fetched without the API's Bearer header (`DownloadPhoto`, a plain Dio). A gray skeleton shows while it loads; if it fails, or no photo was kept, each line shows its stored crop (`cropUrl`) or a box icon.
  3a. **One by one** (opens first; List / One by one switch at the top, same cubit, so edits carry over): a card per line with a large crop, the same badges and editor; **Skip** / **Add · Restock · Restore** buttons, or swipe left / right (a line missing a price or count springs back and says why). Previous goes back a card; after the last one a summary lists every decision (tap one to reopen it) above the **Stock N items, U units** confirm.
  4. **Outcome**: added / restocked / restored / skipped, lines not applied, and the catalogue feedback note. The inventory reloads on the way back.
  5. **History, reopen, rerun, discard** (data and domain layers built, use cases registered; screens *planned*): `GetStocktakeHistory` (`GET …/vision/stocktakes?limit=`, 50 by default, reruns nested oldest first), `GetScan` (`GET …/shelf-scans/:scanId`), `RerunScan` (`POST …/shelf-scans/:scanId/rerun`, then poll `GET …/stocktakes/:runId`) and `DiscardScan` (`POST …/shelf-scans/:scanId/discard`). A 409 (rerun or discard refused) is a `ConflictFailure` carrying the API's message.

  Permissions: iOS `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`.
- **Barcode scan** (`features/inventory`), API side in [barcode-scan.md](barcode-scan.md):
  1. On open, `ScanCubit` caches the business's inventory on the device (`GET …/inventory`).
  2. Each scan is normalised (12-digit UPC-A → 13-digit EAN, same rule as the API) and resolved **from the cache first** — instant and offline. A miss asks the API (another device may have linked it) and caches the hit.
  3. Unknown barcode → pick the item it belongs to (items without a barcode, searchable) → `PUT …/barcode` → cached, so the next scan is instant. A 409 shows the API's message.
  4. If the inventory can't be loaded, scanning still works through the API.

  `ScanCubit` is a per-business factory (`sl<ScanCubit>(param1: businessId)`). Camera: `mobile_scanner`, product formats only (EAN-13/8, UPC-A/E, Code 128/39); stops while a result shows and when the app goes to the background (qore-inventory's pattern). Permissions: iOS `NSCameraUsageDescription`, Android `CAMERA`. The cache isn't refreshed while the scanner is open.

## Not yet

Muse search (Ask your stock), scan history (Scans tab) — see the PRD. Item detail. Release signing (Android keystore, iOS team/profiles). Routing (go_router) now that there are several screens. Persisting the inventory cache between sessions (offline sync).
