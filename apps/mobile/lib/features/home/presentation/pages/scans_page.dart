import 'package:flutter/material.dart';

import '../../../../core/design/v15_widgets.dart';

/// Shelf-scan history. Planned: lists `GET …/scans` once the scan API ships
/// (docs/prd-photo-to-inventory.md, S8). Until then there is nothing to read.
class ScansPage extends StatelessWidget {
  const ScansPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          V15PageHeader(title: 'Scans'),
          Expanded(
            child: V15MessageState(
              icon: IconsOutline.history,
              title: 'No shelf scans yet',
              body: 'Photo scanning is coming soon. Each shelf you scan will be listed here to review or resume.',
            ),
          ),
        ],
      ),
    );
  }
}
