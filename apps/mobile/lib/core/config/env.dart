import 'package:flutter_flavor/flutter_flavor.dart';

/// Runtime config. The flavor (set in `lib/main_<flavor>.dart`) supplies the
/// API URL; Supabase values come from `--dart-define-from-file=config/<flavor>.json`.
/// Only public values belong here — never a service-role key or catalog key.
class Env {
  const Env._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  /// Supabase publishable key (a legacy anon key also works here).
  static const supabasePublishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

  static String get flavor => FlavorConfig.instance.name ?? 'PROD';

  static String get apiBaseUrl => FlavorConfig.instance.variables['apiBaseUrl'] as String;

  /// Names of required values that are empty, so bootstrap can fail loudly.
  static List<String> missing() => [
        if (supabaseUrl.isEmpty) 'SUPABASE_URL',
        if (supabasePublishableKey.isEmpty) 'SUPABASE_PUBLISHABLE_KEY',
        if (apiBaseUrl.isEmpty) 'TALLY_API_URL',
      ];
}
