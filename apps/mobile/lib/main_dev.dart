import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_flavor/flutter_flavor.dart';

import 'bootstrap.dart';

Future<void> main() async {
  // Android emulator reaches the host machine on 10.0.2.2, not localhost.
  final localApi = Platform.isAndroid ? 'http://10.0.2.2:4100/api' : 'http://127.0.0.1:4100/api';
  const apiOverride = String.fromEnvironment('TALLY_API_URL');

  FlavorConfig(
    name: 'DEV',
    color: Colors.red,
    location: BannerLocation.topStart,
    variables: {'apiBaseUrl': apiOverride.isEmpty ? localApi : apiOverride},
  );
  await bootstrap();
}
