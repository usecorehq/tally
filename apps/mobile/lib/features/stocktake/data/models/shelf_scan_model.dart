import '../../domain/entities/shelf_scan.dart';

// JSON → entities for apps/api's vision responses. Stored scans read back
// without candidate names or prices, so those are optional throughout.

ShelfScan shelfScanFromJson(Map<String, dynamic> j) => ShelfScan(
  scanId: j['scanId'] as String,
  catalogueAvailable: j['catalogueAvailable'] as bool? ?? true,
  detections: [for (final d in j['detections'] as List<dynamic>? ?? []) _detection(d as Map<String, dynamic>)],
);

StocktakeRun stocktakeRunFromJson(Map<String, dynamic> j) {
  final run = j['run'] as Map<String, dynamic>;
  final result = j['result'] as Map<String, dynamic>?;
  return StocktakeRun(
    status: StocktakeStatus.values.byName(run['status'] as String),
    error: run['error'] as String?,
    steps: [
      for (final s in j['steps'] as List<dynamic>? ?? [])
        AgentStep(
          turn: (s['turn'] as num).toInt(),
          kind: s['kind'] as String,
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
    invalid: [
      for (final i in j['invalid'] as List<dynamic>? ?? []) (i['detectionId'] as String, i['reason'] as String? ?? ''),
    ],
    feedbackSent: _int(feedback['sent']),
    feedbackError: feedback['error'] as String?,
    imagesUploaded: _int(images['uploaded']),
  );
}

ScanDetection _detection(Map<String, dynamic> d) => ScanDetection(
  id: d['id'] as String,
  brand: d['brand'] as String? ?? '',
  name: d['name'] as String? ?? '',
  pack: d['pack'] as String? ?? '',
  look: d['look'] as String? ?? '',
  count: _int(d['count']),
  countedBySam: d['countSource'] == 'sam',
  sparkCount: _int(d['sparkCount']),
  samCount: (d['samCount'] as num?)?.toInt(),
  boxes: [
    for (final b in d['boxes'] as List<dynamic>? ?? [])
      ScanBox(_num(b['x1']), _num(b['y1']), _num(b['x2']), _num(b['y2'])),
  ],
  confidence: ScanConfidence.values.asNameMap()[d['confidence']] ?? ScanConfidence.medium,
  candidates: [for (final c in d['candidates'] as List<dynamic>? ?? []) _candidate(c as Map<String, dynamic>)],
  inventoryItemId: d['inventoryItemId'] as String?,
  inventoryMatch: InventoryMatch.values.asNameMap()[d['inventoryMatch']],
  inventoryItemArchived: d['inventoryItemArchived'] as bool? ?? false,
  inventoryNeedsConfirm: d['inventoryNeedsConfirm'] as bool? ?? false,
  review: d['review'] as String?,
);

ScanCandidate _candidate(Map<String, dynamic> c) {
  final price = c['price'] as Map<String, dynamic>?;
  return ScanCandidate(
    qid: c['qid'] as String,
    name: c['name'] as String?,
    score: _num(c['score']),
    // Whole Naira (the catalogue's indicative prices).
    priceMedian: (price?['median'] as num?)?.round(),
    priceMin: (price?['min'] as num?)?.round(),
    priceMax: (price?['max'] as num?)?.round(),
    inventoryItemId: c['inventoryItemId'] as String?,
  );
}

int _int(Object? v) => (v as num?)?.toInt() ?? 0;
double _num(Object? v) => (v as num?)?.toDouble() ?? 0;
