import 'package:equatable/equatable.dart';

// apps/api's vision routes (docs/architecture/vision-recognition.md,
// stocktake-agent.md): the quick scan and the stock-take agent return the
// same result, confirmed with …/shelf-scans/:scanId/confirm.

/// One counted unit on the uploaded photo's 0–1000 grid.
class ScanBox extends Equatable {
  const ScanBox(this.x1, this.y1, this.x2, this.y2);
  final double x1;
  final double y1;
  final double x2;
  final double y2;

  double get area => (x2 - x1) * (y2 - y1);

  @override
  List<Object?> get props => [x1, y1, x2, y2];
}

class ScanCandidate extends Equatable {
  const ScanCandidate({
    required this.qid,
    this.name,
    required this.score,
    this.priceMedian,
    this.priceMin,
    this.priceMax,
    this.inventoryItemId,
  });

  final String qid;

  /// Missing on a stored scan read back after the agent's fresh result expired.
  final String? name;
  final double score;

  /// Indicative catalogue shelf price in whole Naira; never a sale amount.
  final int? priceMedian;
  final int? priceMin;
  final int? priceMax;

  /// This business's active item for this product, when it already stocks it.
  final String? inventoryItemId;

  String get label => name ?? qid;

  @override
  List<Object?> get props => [qid, name, score, priceMedian, priceMin, priceMax, inventoryItemId];
}

enum ScanConfidence { high, medium, low }

/// How the merchant's item was found: a remembered reading, the catalogue match, or its name.
enum InventoryMatch { reading, catalogue, name }

class ScanDetection extends Equatable {
  const ScanDetection({
    required this.id,
    required this.brand,
    required this.name,
    required this.pack,
    this.look = '',
    required this.count,
    this.countedBySam = false,
    this.sparkCount = 0,
    this.samCount,
    this.boxes = const [],
    this.confidence = ScanConfidence.medium,
    this.candidates = const [],
    this.inventoryItemId,
    this.inventoryMatch,
    this.inventoryItemArchived = false,
    this.inventoryNeedsConfirm = false,
    this.review,
  });

  final String id;
  final String brand;
  final String name;
  final String pack;

  /// The visual phrase SAM counted with, e.g. "red toothpaste box".
  final String look;
  final int count;

  /// SAM's count (else Muse Spark's estimate).
  final bool countedBySam;
  final int sparkCount;
  final int? samCount;
  final List<ScanBox> boxes;
  final ScanConfidence confidence;
  final List<ScanCandidate> candidates;

  /// The business's item this looks like: confirming restocks it.
  final String? inventoryItemId;
  final InventoryMatch? inventoryMatch;

  /// That item was removed: offer to restore it rather than add a duplicate.
  final bool inventoryItemArchived;

  /// Ask "Is this your X?" before treating it as in stock.
  final bool inventoryNeedsConfirm;

  /// Agent scans only: why the merchant should look closely.
  final String? review;

  /// "Peak Full Cream Milk Powder 400g", as read off the label.
  String get reading => [brand, name, pack].where((s) => s.isNotEmpty).join(' ');

  ScanBox? get largestBox => boxes.isEmpty ? null : boxes.reduce((best, b) => b.area > best.area ? b : best);

  @override
  List<Object?> get props => [
    id,
    brand,
    name,
    pack,
    look,
    count,
    countedBySam,
    sparkCount,
    samCount,
    boxes,
    confidence,
    candidates,
    inventoryItemId,
    inventoryMatch,
    inventoryItemArchived,
    inventoryNeedsConfirm,
    review,
  ];
}

class ShelfScan extends Equatable {
  const ShelfScan({required this.scanId, required this.detections, this.catalogueAvailable = true});
  final String scanId;
  final List<ScanDetection> detections;

  /// False when Qore Catalog failed: detections come back without candidates.
  final bool catalogueAvailable;

  @override
  List<Object?> get props => [scanId, detections, catalogueAvailable];
}

enum StocktakeStatus { running, done, fallback, failed }

class AgentStep extends Equatable {
  const AgentStep({required this.turn, required this.kind, this.tool, required this.summary});
  final int turn;

  /// `baseline`, `thought` or `tool`.
  final String kind;
  final String? tool;
  final String summary;

  @override
  List<Object?> get props => [turn, kind, tool, summary];
}

/// A stock-take agent run, polled until it isn't running.
class StocktakeRun extends Equatable {
  const StocktakeRun({required this.status, this.error, this.steps = const [], this.result});
  final StocktakeStatus status;
  final String? error;
  final List<AgentStep> steps;

  /// Set once finished (done, or fallback to the first pass).
  final ShelfScan? result;

  @override
  List<Object?> get props => [status, error, steps, result];
}

class ScanConfirmResult extends Equatable {
  const ScanConfirmResult({
    required this.created,
    required this.restocked,
    required this.restored,
    required this.skipped,
    this.alreadyDecided = 0,
    this.invalid = const [],
    this.feedbackSent = 0,
    this.feedbackError,
    this.imagesUploaded = 0,
  });

  final int created;
  final int restocked;
  final int restored;
  final int skipped;

  /// Confirmed by an earlier request (a retry); left as they were.
  final int alreadyDecided;

  /// Lines not applied: (detectionId, reason).
  final List<(String, String)> invalid;
  final int feedbackSent;

  /// The catalogue was unreachable; feedback is retried on the next confirm. Stock is still updated.
  final String? feedbackError;
  final int imagesUploaded;

  @override
  List<Object?> get props => [
    created,
    restocked,
    restored,
    skipped,
    alreadyDecided,
    invalid,
    feedbackSent,
    feedbackError,
    imagesUploaded,
  ];
}
