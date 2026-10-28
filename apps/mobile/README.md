# qore_tally (apps/mobile)

Flutter inventory + sales app for Qorelly merchants. Android + iOS. Clean architecture, feature-first — see [docs/architecture/mobile.md](../../docs/architecture/mobile.md).

```
lib/
  main_dev.dart / main_staging.dart / main_prod.dart   flavor entrypoints (FlavorConfig → bootstrap)
  bootstrap.dart             validates config, wires get_it, runApp with the flavor banner
  app.dart                   AuthBloc-driven root
  injection_container.dart   get_it wiring
  core/                      config, error (Exception → Failure), network (Dio → apps/api), usecase
  features/<name>/
    data/                    datasources, models, repository impls (catch exceptions → Left(Failure))
    domain/                  entities, repository contracts, use cases (Either<Failure, T>)
    presentation/            bloc (app-level flows), cubit (screen-local state), pages
.env.example                 template for .env.dev / .env.staging / .env.prod (gitignored)
tool/setup_ios_flavors.rb    wires iOS build configs, xcconfigs, schemes and Podfile for every flavor
```

## Flavors

Three flavors, each with its own bundle / application ID and launcher name so they install side by side. Why it's built this way, the diagram, and troubleshooting: [docs/architecture/mobile-flavors.md](../../docs/architecture/mobile-flavors.md).

| Flavor | Entrypoint | Android application ID | iOS bundle ID | Launcher name | Banner | API |
|---|---|---|---|---|---|---|
| `dev` | `lib/main_dev.dart` | `com.qorelly.tally.dev` | `com.qorelly.tally.dev` | Tally Dev | red DEV | local apps/api (`10.0.2.2` on the Android emulator, `127.0.0.1` on iOS) unless `TALLY_API_URL` is set |
| `staging` | `lib/main_staging.dart` | `com.qorelly.tally.staging` | `com.qorelly.tally.staging` | Tally Staging | orange STAGING | `TALLY_API_URL` (required) |
| `prod` | `lib/main_prod.dart` | `com.qorelly.tally` | `com.qorelly.tally` | Tally | none | `TALLY_API_URL` (required) |

### 1. Create each environment's env file (once)

Same layout as qore-mobile: one gitignored `.env.<flavor>` per environment at the app root.

```bash
cp .env.example .env.dev
cp .env.example .env.staging
cp .env.example .env.prod
```

| Key | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Shared Qorelly Supabase project |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key (a legacy anon key also works). Public values only |
| `TALLY_API_URL` | staging, prod | e.g. `https://<host>/api`. Optional for dev |

`.env.*` (except `.env.example`) is gitignored. The app refuses to start and names the missing keys if any are empty.

### 2. Run

Pass `--flavor`, the matching `-t` entrypoint, and the matching `.env.<flavor>` file. Flutter does not check that `--flavor` and `-t` agree, so always use the pair below. The same commands work for Android and iOS — Flutter picks the platform from the selected device.

```bash
flutter run --flavor dev     -t lib/main_dev.dart     --dart-define-from-file=.env.dev
flutter run --flavor staging -t lib/main_staging.dart --dart-define-from-file=.env.staging
flutter run --flavor prod    -t lib/main_prod.dart    --dart-define-from-file=.env.prod
```

For `dev`, start apps/api first (`pnpm --filter @tally/api dev` from the repo root, port 4100). On a physical device, set `TALLY_API_URL` in `.env.dev` to your machine's LAN IP.

VS Code — `.vscode/launch.json` at the repo root (not committed; add the other flavors the same way):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "mobile: dev",
      "type": "dart",
      "request": "launch",
      "cwd": "apps/mobile",
      "program": "lib/main_dev.dart",
      "args": ["--flavor", "dev", "--dart-define-from-file=.env.dev"]
    }
  ]
}
```

Android Studio: Run → Edit Configurations → Flutter, set *Dart entrypoint* to `lib/main_<flavor>.dart`, *Build flavor* to `<flavor>`, and *Additional run args* to `--dart-define-from-file=.env.<flavor>`.

### 3. Build

Replace `<flavor>` with `dev`, `staging` or `prod`.

**Android**
```bash
flutter build apk       --release --flavor <flavor> -t lib/main_<flavor>.dart --dart-define-from-file=.env.<flavor>
flutter build appbundle --release --flavor <flavor> -t lib/main_<flavor>.dart --dart-define-from-file=.env.<flavor>
```

**iOS**
```bash
flutter build ios --release --flavor <flavor> -t lib/main_<flavor>.dart --dart-define-from-file=.env.<flavor>
flutter build ipa --release --flavor <flavor> -t lib/main_<flavor>.dart --dart-define-from-file=.env.<flavor>
```

Release signing is not configured yet: Android release builds use the debug key, and iOS needs a team + profiles per bundle ID in Xcode.

### Where flavors are wired

| Platform | Files |
|---|---|
| Dart | `lib/main_<flavor>.dart` (FlavorConfig: name, banner, `apiBaseUrl`), `lib/core/config/env.dart` |
| Android | `android/app/build.gradle.kts` — `productFlavors` (ID suffix, `app_name`, cleartext only for dev) and `buildFeatures.resValues = true` (AGP 9 turns it off); manifest uses `@string/app_name` |
| iOS | Build configurations `Debug/Profile/Release-<flavor>`, `ios/Flutter/<Config>-<flavor>.xcconfig`, shared schemes `ios/Runner.xcodeproj/xcshareddata/xcschemes/<flavor>.xcscheme`, `APP_DISPLAY_NAME` → `CFBundleDisplayName`, Podfile config map |

### Adding or renaming a flavor

1. Add it to `productFlavors` in `android/app/build.gradle.kts`.
2. Add it to `FLAVORS` in `tool/setup_ios_flavors.rb`, then run `ruby tool/setup_ios_flavors.rb` (idempotent) and `cd ios && pod install`.
3. Add `lib/main_<flavor>.dart`.
4. Update the table above, [docs/architecture/mobile-flavors.md](../../docs/architecture/mobile-flavors.md) and the diagram (`docs/diagrams/mermaid/mobile-flavors.mmd`, then `pnpm docs:diagrams mobile-flavors`).

## Checks

Same as CI:

```bash
flutter analyze
flutter test
flutter build apk --debug --flavor dev -t lib/main_dev.dart   # catches Gradle / flavor config errors
```

iOS is not built in CI yet; before merging iOS changes run:

```bash
flutter build ios --simulator --debug --flavor dev -t lib/main_dev.dart
```
