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

/// How well a candidate fits what was read: strong = brand and size agree; medium = brand agrees, or a
/// strong name match; low = only just plausible.
enum MatchStrength { strong, medium, low }

class ScanSize extends Equatable {
  const ScanSize(this.value, this.unit);
  final num value;
  final String unit;

  @override
  List<Object?> get props => [value, unit];
}

/// The catalogue's approved picture; width and height may be unknown.
class CatalogImage extends Equatable {
  const CatalogImage({required this.url, this.width, this.height});
  final String url;
  final int? width;
  final int? height;

  @override
  List<Object?> get props => [url, width, height];
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
    this.match,
    this.brand,
    this.variantLabel,
    this.size,
    this.packQty = 1,
    this.image,
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

  /// Missing on a stored scan saved before match strengths were kept (treat as medium).
  final MatchStrength? match;
  final String? brand;
  final String? variantLabel;
  final ScanSize? size;
  final int packQty;

  /// Null until a curator approves one.
  final CatalogImage? image;

  String get label => name ?? qid;

  @override
  List<Object?> get props => [
    qid,
    name,
    score,
    priceMedian,
    priceMin,
    priceMax,
    inventoryItemId,
    match,
    brand,
    variantLabel,
    size,
    packQty,
    image,
  ];
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
    this.inventoryItemName,
    this.position,
    this.cropUrl,
    this.decision,
    this.evidence = const [],
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

  /// The store item's name, for a line that matched one.
  final String? inventoryItemName;

  /// A reopened scan only: order in the scan, the stored crop (presigned, may 404) and the line's decision.
  final int? position;
  final String? cropUrl;
  final LineDecision? decision;

  /// Agent scans only: the agent's notes on this line.
  final List<ScanEvidence> evidence;

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
    inventoryItemName,
    position,
    cropUrl,
    decision,
    evidence,
  ];
}

/// What the merchant decided for a line on an earlier confirm.
class LineDecision extends Equatable {
  const LineDecision({
    required this.action,
    this.itemId,
    this.itemName,
    this.quantity,
    this.confirmedQid,
    this.decidedAt,
  });

  /// restock, restore, add or skip.
  final String action;
  final String? itemId;
  final String? itemName;
  final int? quantity;
  final String? confirmedQid;
  final DateTime? decidedAt;

  @override
  List<Object?> get props => [action, itemId, itemName, quantity, confirmedQid, decidedAt];
}

class ScanEvidence extends Equatable {
  const ScanEvidence({required this.turn, required this.tool, required this.summary});
  final int turn;
  final String tool;
  final String summary;

  @override
  List<Object?> get props => [turn, tool, summary];
}

/// discarded: dropped unconfirmed; superseded: another run of the same photo was confirmed. Both read-only.
enum ScanStatus { open, confirmed, discarded, superseded }

class ShelfScan extends Equatable {
  const ShelfScan({
    required this.scanId,
    required this.detections,
    this.catalogueAvailable = true,
    this.status = ScanStatus.open,
    this.createdAt,
    this.confirmedAt,
    this.discardedAt,
    this.supersededAt,
    this.rerunOf,
    this.canRerun = false,
    this.candidateDetails = true,
    this.photoUrl,
    this.photoStored = false,
  });
  final String scanId;
  final List<ScanDetection> detections;

  /// False when Qore Catalog failed: detections come back without candidates.
  final bool catalogueAvailable;

  /// A quick scan's fresh result is open; a reopened scan says.
  final ScanStatus status;
  final DateTime? createdAt;
  final DateTime? confirmedAt;
  final DateTime? discardedAt;
  final DateTime? supersededAt;

  /// The photo's first scan when this one is a rerun.
  final String? rerunOf;

  /// The photo is stored and no run of it has moved stock yet.
  final bool canRerun;

  /// False when some candidate names and prices couldn't be fetched again.
  final bool candidateDetails;

  /// The stored shelf photo (presigned, about an hour); null when none was kept.
  final String? photoUrl;

  /// Quick scan only: the photo was stored with the scan.
  final bool photoStored;

  bool get readOnly => status != ScanStatus.open;

  @override
  List<Object?> get props => [
    scanId,
    detections,
    catalogueAvailable,
    status,
    createdAt,
    confirmedAt,
    discardedAt,
    supersededAt,
    rerunOf,
    canRerun,
    candidateDetails,
    photoUrl,
    photoStored,
  ];
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
  const StocktakeRun({
    required this.status,
    this.error,
    this.steps = const [],
    this.result,
    this.runId = '',
    this.scanId,
    this.rerunOfScanId,
    this.startedAt,
    this.finishedAt,
    this.photoUrl,
  });
  final StocktakeStatus status;
  final String? error;
  final List<AgentStep> steps;

  /// Set once finished (done, or fallback to the first pass).
  final ShelfScan? result;
  final String runId;
  final String? scanId;

  /// A rerun: the photo's first scan.
  final String? rerunOfScanId;
  final DateTime? startedAt;
  final DateTime? finishedAt;

  /// The shelf photo, also while a rerun is still running (the result carries its own once saved).
  final String? photoUrl;

  @override
  List<Object?> get props => [
    status,
    error,
    steps,
    result,
    runId,
    scanId,
    rerunOfScanId,
    startedAt,
    finishedAt,
    photoUrl,
  ];
}

/// POST …/shelf-scans/:scanId/rerun: the new run to poll, grouped under [rerunOf].
class ScanRerun extends Equatable {
  const ScanRerun({required this.runId, required this.rerunOf});
  final String runId;
  final String rerunOf;

  @override
  List<Object?> get props => [runId, rerunOf];
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
    this.scanConfirmed = false,
    this.superseded = 0,
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
  final bool scanConfirmed;

  /// Other runs of the same photo this confirm made read-only.
  final int superseded;

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
    scanConfirmed,
    superseded,
  ];
}
