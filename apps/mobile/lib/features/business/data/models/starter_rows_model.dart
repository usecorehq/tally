import '../../domain/entities/starter_items.dart';

/// `GET /api/catalog/subtypes/:code/templates?suggestions=2` → one row per
/// template item, candidates deduped: ranked suggestions (with prices) first,
/// then the template's own product if it isn't among them (apps/mp's toRows).
List<StarterRow> starterRowsFromJson(Map<String, dynamic> json) => [
  for (final t in _list(json['templates']))
    for (final g in _list(t['groups']))
      for (final (i, item) in _list(g['items']).indexed)
        StarterRow(
          key: '${t['code']}:${g['code']}:$i',
          groupLabel: g['label'] as String,
          templateName: item['name'] as String,
          candidates: _candidates(item),
        ),
];

List<StarterCandidate> _candidates(Map<String, dynamic> item) {
  final seen = <String>{};
  final pool = [
    ..._list(item['suggestions']),
    if (item['product'] case final Map<String, dynamic> p) {...p, 'score': 0},
  ];
  return [
    for (final c in pool)
      if (seen.add(c['qid'] as String))
        StarterCandidate(
          qid: c['qid'] as String,
          name: c['name'] as String,
          variantLabel: c['variantLabel'] as String?,
          sizeValue: (c['size'] as Map<String, dynamic>?)?['value'] as num?,
          sizeUnit: (c['size'] as Map<String, dynamic>?)?['unit'] as String?,
          packQty: (c['packQty'] as num?)?.toInt() ?? 1,
          categoryPath: (c['category'] as Map<String, dynamic>)['path'] as String,
          score: c['score'] as num? ?? 0,
          priceMedian: ((c['price'] as Map<String, dynamic>?)?['median'] as num?)?.round(),
        ),
  ];
}

List<Map<String, dynamic>> _list(Object? v) => (v as List<dynamic>? ?? []).cast<Map<String, dynamic>>();

StarterResult starterResultFromJson(Map<String, dynamic> json) => StarterResult(
  created: json['created'] as int? ?? 0,
  skipped: json['skipped'] as int? ?? 0,
  removed: json['removed'] as int? ?? 0,
  invalid: (json['invalid'] as List<dynamic>? ?? []).length,
);
