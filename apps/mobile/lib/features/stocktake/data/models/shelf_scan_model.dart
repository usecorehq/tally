import '../../domain/entities/photo_check.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/entities/stocktake_history.dart';

// JSON → entities for apps/api's vision responses. Stored scans can lack candidate names and prices,
// so a missing or unknown field falls back rather than throwing.

ShelfScan shelfScanFromJson(Map<String, dynamic> j) => ShelfScan(
  scanId: j['scanId'] as String? ?? '',
  catalogueAvailable: j['catalogueAvailable'] as bool? ?? true,
  detections: [for (final d in _list(j['detections'])) _detection(d as Map<String, dynamic>)],
  status: ScanStatus.values.asNameMap()[j['status']] ?? ScanStatus.open,
  createdAt: _date(j['createdAt']),
  confirmedAt: _date(j['confirmedAt']),
  discardedAt: _date(j['discardedAt']),
  supersededAt: _date(j['supersededAt']),
  rerunOf: j['rerunOf'] as String?,
  canRerun: j['canRerun'] as bool? ?? false,
  candidateDetails: j['candidateDetails'] as bool? ?? true,
  photoUrl: j['photoUrl'] as String?,
  photoStored: j['photoStored'] as bool? ?? false,
);

StocktakeRun stocktakeRunFromJson(Map<String, dynamic> j) {
  final run = j['run'] as Map<String, dynamic>? ?? const {};
  final result = j['result'] as Map<String, dynamic>?;
  return StocktakeRun(
    runId: run['id'] as String? ?? '',
    status: StocktakeStatus.values.asNameMap()[run['status']] ?? StocktakeStatus.running,
    error: run['error'] as String?,
    scanId: run['scanId'] as String?,
    rerunOfScanId: run['rerunOfScanId'] as String?,
    startedAt: _date(run['startedAt']),
    finishedAt: _date(run['finishedAt']),
    photoUrl: j['photoUrl'] as String?,
    steps: [
      for (final s in _list(j['steps']))
        AgentStep(
          turn: _int(s['turn']),
          kind: s['kind'] as String? ?? 'tool',
          tool: s['tool'] as String?,
          summary: s['summary'] as String? ?? '',
        ),
    ],
    result: result == null ? null : shelfScanFromJson(result),
  );
}

ScanConfirmResult confirmResultFromJson(Map<String, dynamic> j) {
  final feedback = j['feedback'] as Map<String, dynamic>? ?? const {};
  final images = j['images'] as Map<String, dynamic>? ?? const {};
  return ScanConfirmResult(
    created: _int(j['created']),
    restocked: _int(j['restocked']),
    restored: _int(j['restored']),
    skipped: _int(j['skipped']),
    alreadyDecided: _int(j['alreadyDecided']),
    invalid: [for (final i in _list(j['invalid'])) (i['detectionId'] as String? ?? '', i['reason'] as String? ?? '')],
    feedbackSent: _int(feedback['sent']),
    feedbackError: feedback['error'] as String?,
    imagesUploaded: _int(images['uploaded']),
    scanConfirmed: j['scanConfirmed'] as bool? ?? false,
    superseded: _int(j['superseded']),
  );
}

List<HistoryEntry> historyFromJson(List<dynamic> j) => [
  for (final e in j) historyEntryFromJson(e as Map<String, dynamic>),
];

HistoryEntry historyEntryFromJson(Map<String, dynamic> j) {
  final decided = j['decided'] as Map<String, dynamic>? ?? const {};
  final kind = HistoryKind.values.asNameMap()[j['kind']] ?? HistoryKind.stocktake;
  return HistoryEntry(
    id: j['id'] as String? ?? '',
    kind: kind,
    runId: j['runId'] as String?,
    scanId: j['scanId'] as String?,
    status: HistoryStatus.values.asNameMap()[j['status']] ?? HistoryStatus.review,
    rerunOf: j['rerunOf'] as String?,
    reruns: [for (final r in _list(j['reruns'])) historyEntryFromJson(r as Map<String, dynamic>)],
    fallback: j['fallback'] as bool? ?? false,
    startedAt: _date(j['startedAt']) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    confirmedAt: _date(j['confirmedAt']),
    error: j['error'] as String?,
    lines: (j['lines'] as num?)?.toInt(),
    decided: DecidedLines(
      add: _int(decided['add']),
      restock: _int(decided['restock']),
      restore: _int(decided['restore']),
      skip: _int(decided['skip']),
    ),
    preview: [for (final p in _list(j['preview'])) '$p'],
  );
}

PhotoCheck photoCheckFromJson(Map<String, dynamic> j) {
  final issues = {for (final i in PhotoIssue.values) i.wire: i};
  return PhotoCheck(
    verdict: PhotoVerdict.values.asNameMap()[j['verdict']] ?? PhotoVerdict.usable,
    issues: [for (final i in _list(j['issues'])) ?issues[i]],
    instruction: j['instruction'] as String? ?? '',
    productsVisible: _int(j['productsVisible']),
    labelsLegible: LabelsLegible.values.asNameMap()[j['labelsLegible']] ?? LabelsLegible.some,
    region: _box(j['region']),
    model: j['model'] as String? ?? '',
    ms: _int(j['ms']),
  );
}

ScanDetection _detection(Map<String, dynamic> d) => ScanDetection(
  id: d['id'] as String? ?? '',
  brand: d['brand'] as String? ?? '',
  name: d['name'] as String? ?? '',
  pack: d['pack'] as String? ?? '',
  look: d['look'] as String? ?? '',
  count: _int(d['count']),
  countedBySam: d['countSource'] == 'sam',
  sparkCount: _int(d['sparkCount']),
  samCount: (d['samCount'] as num?)?.toInt(),
  boxes: [for (final b in _list(d['boxes'])) ?_box(b)],
  confidence: ScanConfidence.values.asNameMap()[d['confidence']] ?? ScanConfidence.medium,
  candidates: [for (final c in _list(d['candidates'])) _candidate(c as Map<String, dynamic>)],
  inventoryItemId: d['inventoryItemId'] as String?,
  inventoryMatch: InventoryMatch.values.asNameMap()[d['inventoryMatch']],
  inventoryItemArchived: d['inventoryItemArchived'] as bool? ?? false,
  inventoryNeedsConfirm: d['inventoryNeedsConfirm'] as bool? ?? false,
  review: d['review'] as String?,
  inventoryItemName: d['inventoryItemName'] as String?,
  position: (d['position'] as num?)?.toInt(),
  cropUrl: d['cropUrl'] as String?,
  decision: _decision(d['decision']),
  evidence: [
    for (final e in _list(d['evidence']))
      ScanEvidence(turn: _int(e['turn']), tool: e['tool'] as String? ?? '', summary: e['summary'] as String? ?? ''),
  ],
);

LineDecision? _decision(Object? v) {
  if (v is! Map<String, dynamic>) return null;
  return LineDecision(
    action: v['action'] as String? ?? 'skip',
    itemId: v['itemId'] as String?,
    itemName: v['itemName'] as String?,
    quantity: (v['quantity'] as num?)?.toInt(),
    confirmedQid: v['confirmedQid'] as String?,
    decidedAt: _date(v['decidedAt']),
  );
}

ScanCandidate _candidate(Map<String, dynamic> c) {
  final price = c['price'] as Map<String, dynamic>?;
  final size = c['size'] as Map<String, dynamic>?;
  final image = c['image'] as Map<String, dynamic>?;
  return ScanCandidate(
    qid: c['qid'] as String? ?? '',
    name: c['name'] as String?,
    score: _num(c['score']),
    // Whole Naira (the catalogue's indicative prices).
    priceMedian: (price?['median'] as num?)?.round(),
    priceMin: (price?['min'] as num?)?.round(),
    priceMax: (price?['max'] as num?)?.round(),
    inventoryItemId: c['inventoryItemId'] as String?,
    match: MatchStrength.values.asNameMap()[c['match']],
    brand: c['brand'] as String?,
    variantLabel: c['variantLabel'] as String?,
    size: size?['value'] is num ? ScanSize(size!['value'] as num, size['unit'] as String? ?? '') : null,
    packQty: (c['packQty'] as num?)?.toInt() ?? 1,
    image: image?['url'] is String
        ? CatalogImage(
            url: image!['url'] as String,
            width: (image['width'] as num?)?.toInt(),
            height: (image['height'] as num?)?.toInt(),
          )
        : null,
  );
}

ScanBox? _box(Object? b) =>
    b is Map<String, dynamic> ? ScanBox(_num(b['x1']), _num(b['y1']), _num(b['x2']), _num(b['y2'])) : null;

List<dynamic> _list(Object? v) => v is List<dynamic> ? v : const [];
DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;
int _int(Object? v) => (v as num?)?.toInt() ?? 0;
double _num(Object? v) => (v as num?)?.toDouble() ?? 0;
