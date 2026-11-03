import 'package:equatable/equatable.dart';

// One row of GET …/vision/stocktakes: a stock-take run or a quick scan,
// with its reruns nested under the photo's first scan.

enum HistoryKind { stocktake, quick }

/// review: the scan is open (ready to confirm).
enum HistoryStatus { running, review, confirmed, failed, discarded, superseded }

/// Decided lines by the action the merchant chose.
class DecidedLines extends Equatable {
  const DecidedLines({this.add = 0, this.restock = 0, this.restore = 0, this.skip = 0});
  final int add;
  final int restock;
  final int restore;
  final int skip;

  int get total => add + restock + restore + skip;

  @override
  List<Object?> get props => [add, restock, restore, skip];
}

class HistoryEntry extends Equatable {
  const HistoryEntry({
    required this.id,
    required this.kind,
    this.runId,
    this.scanId,
    required this.status,
    this.rerunOf,
    this.reruns = const [],
    this.fallback = false,
    required this.startedAt,
    this.confirmedAt,
    this.error,
    this.lines,
    this.decided = const DecidedLines(),
    this.preview = const [],
  });

  /// The run id for a stock-take, the scan id for a quick scan.
  final String id;
  final HistoryKind kind;
  final String? runId;
  final String? scanId;
  final HistoryStatus status;

  /// The group's root scan when this is a rerun.
  final String? rerunOf;

  /// On a root only: its reruns, oldest first.
  final List<HistoryEntry> reruns;

  /// The agent stopped and the result is the first pass.
  final bool fallback;
  final DateTime startedAt;
  final DateTime? confirmedAt;
  final String? error;

  /// Lines in the scan; null while running or when it failed.
  final int? lines;
  final DecidedLines decided;

  /// Up to 3 distinct products read: the entry's title.
  final List<String> preview;

  @override
  List<Object?> get props => [
    id,
    kind,
    runId,
    scanId,
    status,
    rerunOf,
    reruns,
    fallback,
    startedAt,
    confirmedAt,
    error,
    lines,
    decided,
    preview,
  ];
}
