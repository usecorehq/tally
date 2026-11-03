import 'package:flutter/material.dart';

import '../../../../../core/design/v15_widgets.dart';
import '../../../domain/entities/shelf_scan.dart';
import '../../../domain/entities/stocktake_history.dart';
import '../../widgets/scan_photo.dart';
import '../history_text.dart';

/// A finished stock-take, read-only (apps/mp's confirmed-view): how it ended, the four tallies, the stored
/// photo and each line's decision.
class FinishedScan extends StatelessWidget {
  const FinishedScan({
    super.key,
    required this.scan,
    required this.kind,
    required this.businessName,
    required this.load,
  });
  final ShelfScan scan;
  final HistoryKind kind;
  final String businessName;
  final PhotoBytesLoader load;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (icon, iconColor) = switch (scan.status) {
      ScanStatus.discarded => (IconsOutline.close_circle, c.gray500),
      ScanStatus.superseded => (IconsOutline.history, c.gray500),
      _ => (IconsOutline.check_circle, c.greenFg),
    };
    final title = scan.rerunOf != null
        ? 'Stock-take rerun'
        : kind == HistoryKind.stocktake
        ? 'Stock-take'
        : 'Quick scan';
    final started = scan.createdAt;
    final tiles = decisionCounts(scan);
    return PhotoDownloads(
      load: load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(scanEnding(scan), style: V15.label.copyWith(color: c.gray600)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(title, style: V15.pageTitle.copyWith(color: c.gray900)),
          const SizedBox(height: 2),
          Text(
            [
              businessName,
              if (started != null) 'started ${formatDateTime(started)}',
              plural(scan.detections.length, 'line'),
            ].join(' · '),
            style: V15.description.copyWith(color: c.gray500),
          ),
          const SizedBox(height: 16),
          for (final pair in [tiles.sublist(0, 2), tiles.sublist(2)]) ...[
            Row(
              children: [
                for (final (i, (label, n)) in pair.indexed) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: V15Tile(label: label, value: '$n'),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
          ],
          // Skeleton while it downloads; nothing when none was kept or the link failed.
          RemotePhoto(
            key: ValueKey(scan.photoUrl),
            url: scan.photoUrl,
            load: load,
            builder: (_, photo) => photo.image != null
                ? Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: V15Tray(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          V15Sheet(
                            padding: const EdgeInsets.all(4),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: ScanPhotoView(image: photo.image!),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
                            child: Text('Shelf photo', style: V15.caption.copyWith(color: c.gray500)),
                          ),
                        ],
                      ),
                    ),
                  )
                : photo.loading
                ? const Padding(padding: EdgeInsets.only(top: 8), child: PhotoSkeleton())
                : const SizedBox.shrink(),
          ),
          const SizedBox(height: 16),
          V15Section(
            title: 'Lines',
            count: scan.detections.length,
            rows: [
              if (scan.detections.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'No products were found in this photo.',
                    style: V15.description.copyWith(color: c.gray500),
                  ),
                ),
              for (final d in scan.detections) _Line(d: d),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'An added line becomes a restock when the item already existed.',
            style: V15.caption.copyWith(color: c.gray400),
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.d});
  final ScanDetection d;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (label, tone) = decisionPill(d.decision);
    final decidedAt = d.decision?.decidedAt;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // No photo here: the stored crop, else the box icon.
          ScanThumb(image: null, box: null, cropUrl: d.cropUrl),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  d.reading.isEmpty ? 'Unreadable label' : d.reading,
                  style: V15.cardHeading.copyWith(color: c.gray900),
                ),
                const SizedBox(height: 2),
                Text(lineOutcome(d), style: V15.description.copyWith(color: c.gray500)),
                if (d.review != null) ...[
                  const SizedBox(height: 4),
                  Text('Flagged: ${d.review}', style: V15.caption.copyWith(color: c.amberFg)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              V15Pill(label, tone: tone),
              if (decidedAt != null) ...[
                const SizedBox(height: 4),
                Text(formatClock(decidedAt), style: V15.micro.copyWith(color: c.gray400)),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
