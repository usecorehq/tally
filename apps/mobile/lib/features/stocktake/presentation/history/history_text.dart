import '../../../../core/design/v15_widgets.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/entities/stocktake_history.dart';

// Stock-take history's words and dates, as apps/mp's entry-text.ts and format.ts.
// Dates are Lagos time (UTC+1, no daylight saving) whatever the phone's zone.

String plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

/// The entry's title, like a chat's: what was on the shelf, or what happened to it.
String entryTitle(HistoryEntry e) {
  if (e.status == HistoryStatus.running) return 'Reading the shelf…';
  if (e.status == HistoryStatus.failed) return 'Stock-take failed';
  if (e.lines == 0) return 'Nothing found';
  return e.preview.isNotEmpty ? e.preview.join(', ') : plural(e.lines ?? 0, 'product');
}

/// One line under the title: what it found, or what was decided.
String entrySummary(HistoryEntry e) {
  final lines = plural(e.lines ?? 0, 'line');
  switch (e.status) {
    case HistoryStatus.running:
      return 'The agent is still working on it';
    case HistoryStatus.failed:
      return e.error ?? 'It stopped before finishing';
    case HistoryStatus.discarded:
      return '$lines · discarded, nothing more applied';
    case HistoryStatus.superseded:
      return '$lines · another run of this photo was confirmed';
    case HistoryStatus.review:
      if (e.lines == 0) return 'No products found in the photo';
      final left = (e.lines ?? 0) - e.decided.total;
      return '$lines, $left to confirm${e.fallback ? ' · first pass only' : ''}';
    case HistoryStatus.confirmed:
      final d = e.decided;
      return [
        lines,
        for (final (word, n) in [
          ('added', d.add),
          ('restocked', d.restock),
          ('restored', d.restore),
          ('skipped', d.skip),
        ])
          if (n > 0) '$n $word',
      ].join(' · ');
  }
}

/// A root row's subtitle names its kind; a nested rerun's doesn't.
String entrySubtitle(HistoryEntry e, {bool rerun = false}) =>
    rerun ? entrySummary(e) : '${e.kind == HistoryKind.stocktake ? 'Stock-take' : 'Quick scan'} · ${entrySummary(e)}';

/// The row's status pill; an open scan with no lines reads "Nothing found".
(String, V15PillTone) entryStatus(HistoryEntry e) {
  if (e.status == HistoryStatus.review && e.lines == 0) return ('Nothing found', V15PillTone.gray);
  return switch (e.status) {
    HistoryStatus.running => ('Running', V15PillTone.blue),
    HistoryStatus.review => ('Ready to review', V15PillTone.amber),
    HistoryStatus.confirmed => ('Confirmed', V15PillTone.green),
    HistoryStatus.failed => ('Failed', V15PillTone.red),
    HistoryStatus.discarded => ('Discarded', V15PillTone.gray),
    HistoryStatus.superseded => ('Superseded', V15PillTone.gray),
  };
}

bool isRunning(HistoryEntry e) =>
    e.status == HistoryStatus.running || e.reruns.any((r) => r.status == HistoryStatus.running);

/// A group's newest run: a fresh rerun files the whole group under its day.
DateTime lastActivity(HistoryEntry e) => e.reruns.fold(e.startedAt, (t, r) => r.startedAt.isAfter(t) ? r.startedAt : t);

class HistoryDay {
  const HistoryDay(this.key, this.at, this.entries);

  /// yyyy-mm-dd in Lagos.
  final String key;

  /// The first group's newest activity: what the heading is formatted from.
  final DateTime at;
  final List<HistoryEntry> entries;
}

/// Groups in the API's order (newest activity first) under their Lagos day.
List<HistoryDay> groupByDay(List<HistoryEntry> entries) {
  final days = <String, HistoryDay>{};
  for (final e in entries) {
    final at = lastActivity(e);
    final key = lagosDay(at);
    final day = days[key] ??= HistoryDay(key, at, []);
    day.entries.add(e);
  }
  return days.values.toList();
}

DateTime _lagos(DateTime t) => t.toUtc().add(const Duration(hours: 1));

String _two(int n) => n.toString().padLeft(2, '0');

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _monthsLong = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const _weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

String lagosDay(DateTime t) {
  final l = _lagos(t);
  return '${l.year}-${_two(l.month)}-${_two(l.day)}';
}

/// "10:14", 24-hour.
String formatClock(DateTime t) {
  final l = _lagos(t);
  return '${_two(l.hour)}:${_two(l.minute)}';
}

/// "29 Oct 2026, 10:14".
String formatDateTime(DateTime t) {
  final l = _lagos(t);
  return '${l.day} ${_months[l.month - 1]} ${l.year}, ${formatClock(t)}';
}

/// "Today", "Yesterday" or "Wednesday, 28 October 2026", relative to [now].
String formatDay(DateTime t, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final day = lagosDay(t);
  if (day == lagosDay(n)) return 'Today';
  if (day == lagosDay(n.subtract(const Duration(days: 1)))) return 'Yesterday';
  final l = _lagos(t);
  return '${_weekdays[l.weekday - 1]}, ${l.day} ${_monthsLong[l.month - 1]} ${l.year}';
}

/// A row's time under its day heading: the clock, with the date when it ran on another day.
String formatRowTime(DateTime t, String dayKey) {
  if (lagosDay(t) == dayKey) return formatClock(t);
  final l = _lagos(t);
  return '${l.day} ${_months[l.month - 1]}, ${formatClock(t)}';
}

/// The read-only session's eyebrow: how it ended, and when.
String scanEnding(ShelfScan s) {
  String at(DateTime? t) => t == null ? '' : ' ${formatDateTime(t)}';
  return switch (s.status) {
    ScanStatus.discarded => 'Discarded${at(s.discardedAt)}, nothing more was applied',
    ScanStatus.superseded => 'Superseded${at(s.supersededAt)}: another run of this photo was confirmed',
    _ => 'Confirmed${at(s.confirmedAt)}',
  };
}

/// What happened to one line of a finished scan.
String lineOutcome(ScanDetection d) {
  final decision = d.decision;
  if (decision == null) return 'Counted ${d.count}';
  if (decision.action == 'skip') return 'Counted ${d.count}, nothing changed';
  final q = decision.quantity ?? 0;
  final item = decision.itemName ?? d.inventoryItemName;
  final counted = q != d.count ? ' (counted ${d.count})' : '';
  if (item == null) return 'Added $q$counted';
  return '+$q to $item$counted';
}

(String, V15PillTone) decisionPill(LineDecision? d) => switch (d?.action) {
  'add' => ('Added', V15PillTone.violet),
  'restock' => ('Restocked', V15PillTone.green),
  'restore' => ('Restored', V15PillTone.blue),
  'skip' => ('Skipped', V15PillTone.gray),
  _ => ('Not decided', V15PillTone.gray),
};

/// The four tiles of a finished scan, counted from each line's decision.
List<(String, int)> decisionCounts(ShelfScan s) {
  int count(String a) => s.detections.where((d) => d.decision?.action == a).length;
  return [
    ('Added', count('add')),
    ('Restocked', count('restock')),
    ('Restored', count('restore')),
    ('Skipped', count('skip')),
  ];
}

String sentence(String s) => RegExp(r'[.!?]$').hasMatch(s) ? s : '$s.';
