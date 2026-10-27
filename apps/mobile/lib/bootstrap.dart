import 'package:flutter/material.dart';
import 'package:flutter_flavor/flutter_flavor.dart';

import 'app.dart';
import 'core/config/env.dart';
import 'injection_container.dart';

/// Shared startup for every flavor. Call after FlavorConfig is set.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final missing = Env.missing();
  if (missing.isNotEmpty) {
    throw StateError(
      'Missing ${missing.join(', ')} for flavor ${Env.flavor}. '
      'Run with --dart-define-from-file=config/<flavor>.json (see README).',
    );
  }

  await initDependencies();
  runApp(const FlavorBanner(child: TallyApp()));
}
