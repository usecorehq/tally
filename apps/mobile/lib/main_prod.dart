import 'package:flutter_flavor/flutter_flavor.dart';

import 'bootstrap.dart';

Future<void> main() async {
  // No name → no banner in production.
  FlavorConfig(variables: {'apiBaseUrl': const String.fromEnvironment('TALLY_API_URL')});
  await bootstrap();
}
