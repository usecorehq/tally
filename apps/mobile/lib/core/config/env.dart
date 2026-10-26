/// Compile-time config, passed with --dart-define (see README).
/// Only public values belong here — never a service-role key or catalog key.
class Env {
  const Env._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBaseUrl = String.fromEnvironment(
    'TALLY_API_URL',
    defaultValue: 'http://localhost:4100/api',
  );
}
