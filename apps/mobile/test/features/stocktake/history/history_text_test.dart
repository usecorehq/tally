import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/core/design/v15_widgets.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/entities/stocktake_history.dart';
import 'package:qore_tally/features/stocktake/presentation/history/history_text.dart';

HistoryEntry entry(
  HistoryStatus status, {
  String id = 'e1',
  int? lines = 3,
  DecidedLines decided = const DecidedLines(),
  List<String> preview = const [],
  String? error,
  bool fallback = false,
  DateTime? startedAt,
  List<HistoryEntry> reruns = const [],
  HistoryKind kind = HistoryKind.stocktake,
}) => HistoryEntry(
  id: id,
  kind: kind,
  status: status,
  lines: lines,
  decided: decided,
  preview: preview,
  error: error,
  fallback: fallback,
  startedAt: startedAt ?? DateTime.utc(2026, 10, 29, 9),
  reruns: reruns,
);

void main() {
  group('entryTitle', () {
    test('running, failed, nothing found, preview, or a product count', () {
      expect(entryTitle(entry(HistoryStatus.running, lines: null)), 'Reading the shelf…');
      expect(entryTitle(entry(HistoryStatus.failed, lines: null)), 'Stock-take failed');
      expect(entryTitle(entry(HistoryStatus.review, lines: 0)), 'Nothing found');
      expect(entryTitle(entry(HistoryStatus.confirmed, preview: ['A', 'B', 'C'])), 'A, B, C');
      expect(entryTitle(entry(HistoryStatus.review, lines: 1)), '1 product');
    });
  });

  group('entrySummary', () {
    test('per status', () {
      expect(entrySummary(entry(HistoryStatus.running, lines: null)), 'The agent is still working on it');
      expect(entrySummary(entry(HistoryStatus.failed, lines: null)), 'It stopped before finishing');
      expect(entrySummary(entry(HistoryStatus.failed, error: 'Ran out of time')), 'Ran out of time');
      expect(entrySummary(entry(HistoryStatus.discarded, lines: 1)), '1 line · discarded, nothing more applied');
      expect(entrySummary(entry(HistoryStatus.superseded)), '3 lines · another run of this photo was confirmed');
      expect(entrySummary(entry(HistoryStatus.review, lines: 0)), 'No products found in the photo');
      expect(
        entrySummary(entry(HistoryStatus.review, decided: const DecidedLines(skip: 1), fallback: true)),
        '3 lines, 2 to confirm · first pass only',
      );
      expect(
        entrySummary(entry(HistoryStatus.confirmed, decided: const DecidedLines(add: 2, skip: 1))),
        '3 lines · 2 added · 1 skipped',
      );
    });

    test('a root names its kind; a rerun does not', () {
      final quick = entry(HistoryStatus.running, kind: HistoryKind.quick);
      expect(entrySubtitle(quick), 'Quick scan · The agent is still working on it');
      expect(entrySubtitle(quick, rerun: true), 'The agent is still working on it');
    });
  });

  test('status pill: an empty open scan reads "Nothing found"', () {
    expect(entryStatus(entry(HistoryStatus.review)), ('Ready to review', V15PillTone.amber));
    expect(entryStatus(entry(HistoryStatus.review, lines: 0)), ('Nothing found', V15PillTone.gray));
    expect(entryStatus(entry(HistoryStatus.running)), ('Running', V15PillTone.blue));
    expect(entryStatus(entry(HistoryStatus.failed)), ('Failed', V15PillTone.red));
  });

  group('Lagos dates', () {
    test('a UTC instant late in the evening is the next Lagos day', () {
      expect(lagosDay(DateTime.utc(2026, 10, 28, 23, 30)), '2026-10-29');
      expect(formatClock(DateTime.utc(2026, 10, 28, 23, 30)), '00:30');
      expect(formatDateTime(DateTime.utc(2026, 10, 29, 9, 14)), '29 Oct 2026, 10:14');
    });

    test('Today, Yesterday, else the weekday and date', () {
      final now = DateTime.utc(2026, 10, 29, 12);
      expect(formatDay(DateTime.utc(2026, 10, 29, 0, 5), now: now), 'Today');
      expect(formatDay(DateTime.utc(2026, 10, 28, 22, 59), now: now), 'Yesterday');
      expect(formatDay(DateTime.utc(2026, 10, 27, 10), now: now), 'Tuesday, 27 October 2026');
    });
  });

  group('groupByDay', () {
    test("groups by each group's newest activity, reruns included, keeping the API's order", () {
      final rootYesterday = entry(
        HistoryStatus.superseded,
        id: 'root',
        startedAt: DateTime.utc(2026, 10, 28, 9),
        reruns: [entry(HistoryStatus.running, id: 'rerun', startedAt: DateTime.utc(2026, 10, 29, 8))],
      );
      final today = entry(HistoryStatus.confirmed, id: 'today', startedAt: DateTime.utc(2026, 10, 29, 7));
      final older = entry(HistoryStatus.confirmed, id: 'older', startedAt: DateTime.utc(2026, 10, 27, 7));
      final days = groupByDay([rootYesterday, today, older]);
      expect(days.map((d) => d.key), ['2026-10-29', '2026-10-27']);
      expect(days.first.entries.map((e) => e.id), ['root', 'today']);
      expect(lastActivity(rootYesterday), DateTime.utc(2026, 10, 29, 8));
      expect(isRunning(rootYesterday), isTrue);
      expect(formatRowTime(rootYesterday.startedAt, days.first.key), '28 Oct, 10:00');
      expect(formatRowTime(today.startedAt, days.first.key), '08:00');
    });
  });

  group('finished scan', () {
    const restock = ScanDetection(
      id: 'd1',
      brand: 'B',
      name: 'N',
      pack: '1',
      count: 6,
      decision: LineDecision(action: 'restock', itemName: 'Shelf item', quantity: 4),
    );
    const add = ScanDetection(
      id: 'd2',
      brand: 'B',
      name: 'N',
      pack: '1',
      count: 2,
      decision: LineDecision(action: 'add', quantity: 2),
    );
    const skip = ScanDetection(
      id: 'd3',
      brand: 'B',
      name: 'N',
      pack: '1',
      count: 1,
      decision: LineDecision(action: 'skip'),
    );
    const open = ScanDetection(id: 'd4', brand: 'B', name: 'N', pack: '1', count: 5);

    test('outcome per line', () {
      expect(lineOutcome(restock), '+4 to Shelf item (counted 6)');
      expect(lineOutcome(add), 'Added 2');
      expect(lineOutcome(skip), 'Counted 1, nothing changed');
      expect(lineOutcome(open), 'Counted 5');
      expect(decisionPill(skip.decision), ('Skipped', V15PillTone.gray));
      expect(decisionPill(null), ('Not decided', V15PillTone.gray));
    });

    test('tiles count decisions; the eyebrow says how it ended', () {
      final scan = ShelfScan(
        scanId: 's1',
        detections: const [restock, add, skip, open],
        status: ScanStatus.discarded,
        discardedAt: DateTime.utc(2026, 10, 29, 9, 14),
      );
      expect(decisionCounts(scan), [('Added', 1), ('Restocked', 1), ('Restored', 0), ('Skipped', 1)]);
      expect(scanEnding(scan), 'Discarded 29 Oct 2026, 10:14, nothing more was applied');
      expect(scanEnding(const ShelfScan(scanId: 's', detections: [], status: ScanStatus.confirmed)), 'Confirmed');
    });
  });
}
