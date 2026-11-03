import 'package:flutter/material.dart';

import '../../../../../core/design/v15_widgets.dart';
import '../../../domain/entities/stocktake_history.dart';
import '../history_text.dart';

/// Stock-takes grouped by the Lagos day of each group's newest activity; reruns nested under their root.
class HistoryDays extends StatelessWidget {
  const HistoryDays({super.key, required this.days, required this.onOpen, required this.onDiscard});
  final List<HistoryDay> days;
  final ValueChanged<HistoryEntry> onOpen;

  /// Asks first; true once discarded.
  final Future<bool> Function(String scanId) onDiscard;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final day in days) ...[
          V15Section(
            title: formatDay(day.at),
            count: day.entries.length,
            rows: [
              for (final e in day.entries)
                Column(
                  children: [
                    _EntryRow(entry: e, dayKey: day.key, onOpen: onOpen, onDiscard: onDiscard),
                    for (final r in e.reruns)
                      Padding(
                        padding: const EdgeInsets.only(left: 40),
                        child: _EntryRow(entry: r, dayKey: day.key, onOpen: onOpen, onDiscard: onDiscard, rerun: true),
                      ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({
    required this.entry,
    required this.dayKey,
    required this.onOpen,
    required this.onDiscard,
    this.rerun = false,
  });
  final HistoryEntry entry;
  final String dayKey;
  final ValueChanged<HistoryEntry> onOpen;
  final Future<bool> Function(String scanId) onDiscard;
  final bool rerun;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final e = entry;
    final (status, tone) = entryStatus(e);
    final running = e.status == HistoryStatus.running;
    final icon = rerun
        ? IconsOutline.refresh
        : e.kind == HistoryKind.stocktake
        ? IconsOutline.stars
        : IconsOutline.gallery;
    final size = rerun ? 32.0 : 40.0;
    final row = InkWell(
      onTap: () => onOpen(e),
      child: Padding(
        padding: EdgeInsets.fromLTRB(rerun ? 10 : 14, 12, 14, 12),
        child: Row(
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(color: running ? c.primaryLight : c.gray100, shape: BoxShape.circle),
              child: Icon(icon, size: rerun ? 16 : 18, color: running ? c.primary : c.gray600),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    rerun ? 'Rerun' : entryTitle(e),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: V15.cardHeading.copyWith(color: c.gray900),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    entrySubtitle(e, rerun: rerun),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: V15.description.copyWith(color: c.gray500),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // When it ran, above its status: readable at a glance without the day heading.
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(formatRowTime(e.startedAt, dayKey), style: V15.micro.copyWith(color: c.gray500)),
                const SizedBox(height: 6),
                V15Pill(status, tone: tone),
              ],
            ),
          ],
        ),
      ),
    );
    final scanId = e.scanId;
    if (e.status != HistoryStatus.review || scanId == null) return row;
    // Swipe left to discard; the row stays (now read-only) once the list re-reads.
    return Dismissible(
      key: ValueKey('discard-${e.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        await onDiscard(scanId);
        return false;
      },
      background: Container(
        color: c.dangerBg,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(IconsOutline.trash, size: 18, color: c.dangerFg),
            const SizedBox(width: 6),
            Text('Discard', style: V15.ui.copyWith(color: c.dangerFg)),
          ],
        ),
      ),
      child: row,
    );
  }
}

/// The list's shape while it loads.
class HistorySkeleton extends StatelessWidget {
  const HistorySkeleton({super.key});

  @override
  Widget build(BuildContext context) => const V15Section(title: ' ', rows: [V15SkeletonRows(count: 4)]);
}
