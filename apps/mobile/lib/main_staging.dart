import 'package:flutter/material.dart';
import 'package:flutter_flavor/flutter_flavor.dart';

import 'bootstrap.dart';

Future<void> main() async {
  FlavorConfig(
    name: 'STAGING',
    color: Colors.orange,
    location: BannerLocation.topStart,
    variables: {'apiBaseUrl': const String.fromEnvironment('TALLY_API_URL')},
  );
  await bootstrap();
}
