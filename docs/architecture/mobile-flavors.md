# Mobile flavors

> Diagram: [how a flavor is resolved](../diagrams/images/mobile-flavors.svg)

`qore_tally` ships three flavors — `dev`, `staging`, `prod` — so each environment installs as its own app, side by side, and can never silently talk to another environment's backend. How to run and build them: [apps/mobile/README.md](../../apps/mobile/README.md#flavors).

| Flavor | App / bundle ID | Name | Banner | API | Cleartext http |
|---|---|---|---|---|---|
| `dev` | `com.qorelly.tally.dev` | Tally Dev | red DEV | local apps/api unless `TALLY_API_URL` is set | allowed (Android) |
| `staging` | `com.qorelly.tally.staging` | Tally Staging | orange STAGING | `TALLY_API_URL` (required) | no |
| `prod` | `com.qorelly.tally` | Tally | none | `TALLY_API_URL` (required) | no |

## One command, two halves

`flutter run --flavor staging -t lib/main_staging.dart --dart-define-from-file=.env.staging` drives two independent things, and both must name the same flavor:

1. **`--flavor` → native identity.** Android picks `productFlavors.staging` (ID suffix, `app_name`, cleartext flag). iOS picks the shared scheme `staging`, whose actions point at the `Debug-staging` / `Profile-staging` / `Release-staging` build configurations; those set `PRODUCT_BUNDLE_IDENTIFIER` and `APP_DISPLAY_NAME` and include `ios/Flutter/<Config>-staging.xcconfig`.
2. **`-t` + `--dart-define-from-file` → runtime config.** `main_staging.dart` sets `FlavorConfig` (name, banner colour, `apiBaseUrl`); `.env.staging` provides compile-time defines read by `Env`. `bootstrap()` refuses to start if any required value is empty, naming the missing keys.

Flutter does not check that `--flavor` and `-t` agree. `--flavor prod -t lib/main_dev.dart` builds a prod-identity app with dev config — always pass the matching pair.

## Why these choices

- **Separate IDs per flavor**: testers keep staging and prod installed together; push tokens, keychain and storage never mix.
- **Per-environment `.env.<flavor>` files**: same layout as qore-mobile. They are gitignored; only `.env.example` is committed. Values are public (Supabase URL + publishable key, API URL) — the Qore Catalog key and any service-role key never go into the app.
- **Unsuffixed keys** (`SUPABASE_URL`, not `SUPABASE_URL_DEV` as in qore-mobile): each file already holds exactly one environment.
- **No hardcoded staging/prod URLs**: there is no deployed API yet; `TALLY_API_URL` is required for those flavors rather than defaulting to something wrong.
- **iOS wiring is scripted** (`tool/setup_ios_flavors.rb`, xcodeproj gem): 9 build configurations × 2 targets is too much to keep right by hand in Xcode. The script is idempotent and also writes the Podfile config map — without it CocoaPods treats `Debug-<flavor>` as release.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `Product Flavor dev contains custom resource values, but the feature is disabled` | AGP 9 disables `resValue` by default | `buildFeatures { resValues = true }` in `android/app/build.gradle.kts` (already set) |
| iOS: `Unable to open base configuration reference file '.../ios/Debug-dev.xcconfig'` | xcconfig file reference without the `Flutter/` path | Re-run `ruby tool/setup_ios_flavors.rb` (it repairs references) |
| `StateError: Missing SUPABASE_URL …` at launch | `.env.<flavor>` missing or not passed | `cp .env.example .env.<flavor>`, fill it, pass `--dart-define-from-file=.env.<flavor>` |
| Android emulator can't reach the dev API | `localhost` is the emulator itself | dev uses `10.0.2.2` on Android automatically; physical devices need `TALLY_API_URL` = your LAN IP |
| Debug-<flavor> iOS build links release pods | Podfile config map missing the flavor | Re-run the setup script, then `cd ios && pod install` |

## CI

The mobile job runs `flutter analyze`, `flutter test` and `flutter build apk --debug --flavor dev`. The APK build is what catches Gradle/flavor configuration errors; analyze and test never load the Android build. iOS builds are not in CI yet (needs a macOS runner).

## Not yet

Release signing (Android keystore per flavor, iOS team + provisioning profiles per bundle ID), per-flavor app icons, Firebase/Crashlytics config per flavor.
