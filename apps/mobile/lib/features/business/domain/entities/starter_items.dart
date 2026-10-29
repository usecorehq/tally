import 'package:equatable/equatable.dart';

// Onboarding step 2 — the same rows, rules and API body as apps/mp's
// items-wizard.tsx, so a business set up on the phone is identical to one set
// up on the web (and sends the catalogue the same feedback).

/// A catalogue product offered for a template item, best first.
class StarterCandidate extends Equatable {
  const StarterCandidate({
    required this.qid,
    required this.name,
    this.variantLabel,
    this.sizeValue,
    this.sizeUnit,
    this.packQty = 1,
    required this.categoryPath,
    this.score = 0,
    this.priceMedian,
  });

  final String qid;
  final String name;
  final String? variantLabel;
  final num? sizeValue;
  final String? sizeUnit;
  final int packQty;
  final String categoryPath;

  /// Match score, 0 for the template's own product.
  final num score;

  /// Typical Nigerian shelf price in whole Naira (indicative, not a sale amount).
  final int? priceMedian;

  @override
  List<Object?> get props => [qid, name, variantLabel, sizeValue, sizeUnit, packQty, categoryPath, score, priceMedian];
}

/// One template item ("Milk powder") with its candidates.
class StarterRow extends Equatable {
  const StarterRow({required this.key, required this.groupLabel, required this.templateName, required this.candidates});

  /// `template:group:index` — also the clientRef that makes a retry safe.
  final String key;
  final String groupLabel;
  final String templateName;
  final List<StarterCandidate> candidates;

  StarterCandidate? get suggested => candidates.firstOrNull;

  @override
  List<Object?> get props => [key, groupLabel, templateName, candidates];
}

/// The merchant's answer for a row. [choice] is a candidate's qid, or
/// [StarterChoice.own] for their own product.
class StarterChoice extends Equatable {
  const StarterChoice({
    required this.keep,
    required this.choice,
    this.ownName = '',
    this.price = '',
    this.opening = '',
  });

  static const own = 'own';

  /// Suggested items start kept, priced at the typical price; items with
  /// nothing to suggest start off (they need a name and price).
  factory StarterChoice.initial(StarterRow row) {
    final first = row.suggested;
    return StarterChoice(keep: first != null, choice: first?.qid ?? own, price: first?.priceMedian?.toString() ?? '');
  }

  final bool keep;
  final String choice;
  final String ownName;

  /// Naira as typed (digits, optional 2 decimals) — a string, never a double.
  final String price;

  /// Opening stock as typed; empty for none.
  final String opening;

  bool get isOwn => choice == own;

  StarterChoice copyWith({bool? keep, String? choice, String? ownName, String? price, String? opening}) =>
      StarterChoice(
        keep: keep ?? this.keep,
        choice: choice ?? this.choice,
        ownName: ownName ?? this.ownName,
        price: price ?? this.price,
        opening: opening ?? this.opening,
      );

  @override
  List<Object?> get props => [keep, choice, ownName, price, opening];
}

final _naira = RegExp(r'^\d{1,10}(\.\d{1,2})?$');
final _quantity = RegExp(r'^\d+(\.\d{1,3})?$');

/// What a kept row is missing (mp's rowProblems). A removed row has none.
class StarterProblems extends Equatable {
  const StarterProblems({this.name = false, this.price = false, this.opening = false});

  factory StarterProblems.of(StarterChoice c) {
    if (!c.keep) return const StarterProblems();
    final opening = c.opening.trim();
    return StarterProblems(
      name: c.isOwn && c.ownName.trim().isEmpty,
      price: !_naira.hasMatch(c.price.trim()),
      opening: opening.isNotEmpty && !_quantity.hasMatch(opening),
    );
  }

  final bool name;
  final bool price;
  final bool opening;

  bool get any => name || price || opening;

  @override
  List<Object?> get props => [name, price, opening];
}

/// The candidate [c] picked, or null for their own product.
StarterCandidate? pickedCandidate(StarterRow row, StarterChoice c) =>
    c.isOwn ? null : row.candidates.where((x) => x.qid == c.choice).firstOrNull;

/// The display name a kept row will be stocked under.
String starterItemName(StarterRow row, StarterChoice c) => pickedCandidate(row, c)?.name ?? c.ownName.trim();

/// One item of `POST /businesses/:id/inventory/starter` (mp's toStarterItem):
/// removed / new_item / accepted / corrected, with the catalogue's suggestion
/// for feedback.
Map<String, Object?> toStarterItem(StarterRow row, StarterChoice c) {
  final suggested = row.suggested;
  final base = <String, Object?>{'clientRef': row.key, 'templateItemName': row.templateName};
  if (!c.keep) return {...base, 'outcome': 'removed', 'suggestedQid': ?suggested?.qid};

  final price = c.price.trim();
  final opening = c.opening.trim().isEmpty ? null : num.parse(c.opening.trim());
  final picked = pickedCandidate(row, c);
  if (picked == null) {
    return {
      ...base,
      'outcome': 'new_item',
      if (suggested != null) ...{'suggestedQid': suggested.qid, 'suggestedScore': suggested.score.clamp(0, 1)},
      'name': c.ownName.trim(),
      'price': price,
      'openingQuantity': ?opening,
    };
  }
  final accepted = picked.qid == suggested?.qid;
  return {
    ...base,
    'outcome': accepted ? 'accepted' : 'corrected',
    'suggestedQid': suggested!.qid,
    if (suggested.score > 0) 'suggestedScore': suggested.score.clamp(0, 1),
    if (!accepted) 'qid': picked.qid,
    'name': picked.name,
    'variantLabel': ?picked.variantLabel,
    'sizeValue': ?picked.sizeValue,
    'sizeUnit': ?picked.sizeUnit,
    'packQty': picked.packQty,
    'categoryPath': picked.categoryPath,
    'price': price,
    'openingQuantity': ?opening,
  };
}

/// What the API did with the starter list.
class StarterResult extends Equatable {
  const StarterResult({required this.created, required this.skipped, required this.removed, required this.invalid});

  final int created;

  /// Already in the inventory (a retry): counted as added.
  final int skipped;
  final int removed;

  /// Items the API couldn't take; the rest still applied.
  final int invalid;

  int get added => created + skipped;

  @override
  List<Object?> get props => [created, skipped, removed, invalid];
}
