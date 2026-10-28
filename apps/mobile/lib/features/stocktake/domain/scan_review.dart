import 'package:equatable/equatable.dart';

import 'entities/shelf_scan.dart';

// The review rules of apps/mp's stock-take (app/stocktake/review-table.tsx),
// row for row, so web and mobile send the same confirm body.

enum ScanAction { restock, restore, add, skip }

const kScanActionLabels = {
  ScanAction.restock: 'Restock',
  ScanAction.restore: 'Restore',
  ScanAction.add: 'Add to store',
  ScanAction.skip: 'Skip',
};

final _naira = RegExp(r'^\d{1,10}(\.\d{1,2})?$');
final _count = RegExp(r'^\d{1,6}$');

/// What the merchant can do with a line: the first is the default.
List<ScanAction> actionsFor(ScanDetection d) {
  if (d.inventoryItemId != null && d.inventoryItemArchived) {
    return const [ScanAction.restore, ScanAction.add, ScanAction.skip];
  }
  if (d.inventoryItemId != null) return const [ScanAction.restock, ScanAction.add, ScanAction.skip];
  return const [ScanAction.add, ScanAction.skip];
}

/// Agent-flagged lines first, otherwise in scan order.
List<ScanDetection> reviewOrder(List<ScanDetection> detections) => [
  ...detections.where((d) => d.review != null),
  ...detections.where((d) => d.review == null),
];

/// One line's decision as the merchant edits it.
class ScanChoice extends Equatable {
  const ScanChoice({
    required this.action,
    required this.quantity,
    required this.choice,
    this.name = '',
    this.price = '',
  });

  /// [choice] when the merchant's product isn't in the catalogue.
  static const newItem = 'new';

  /// The default: restock / restore what's in store, else add the top match at its typical price.
  factory ScanChoice.initial(ScanDetection d) {
    final top = d.candidates.firstOrNull;
    return ScanChoice(
      action: actionsFor(d).first,
      quantity: '${d.count}',
      choice: top?.qid ?? newItem,
      name: top?.label ?? d.reading,
      price: top?.priceMedian?.toString() ?? '',
    );
  }

  final ScanAction action;
  final String quantity;

  /// A candidate's Qore ID, or [newItem].
  final String choice;

  /// add: the name to stock it under.
  final String name;

  /// add: the selling price in ₦.
  final String price;

  ScanChoice copyWith({ScanAction? action, String? quantity, String? choice, String? name, String? price}) =>
      ScanChoice(
        action: action ?? this.action,
        quantity: quantity ?? this.quantity,
        choice: choice ?? this.choice,
        name: name ?? this.name,
        price: price ?? this.price,
      );

  @override
  List<Object?> get props => [action, quantity, choice, name, price];
}

/// Picking a product renames the line after it and, when it has one, resets the price to its typical price.
ScanChoice chooseProduct(ScanDetection d, ScanChoice c, String choice) {
  final next = d.candidates.where((x) => x.qid == choice).firstOrNull;
  return c.copyWith(choice: choice, name: next?.label ?? d.reading, price: next?.priceMedian?.toString());
}

/// Whether the product picker applies: adding, or restocking an item found only by its name (links it).
bool productEditable(ScanDetection d, ScanChoice c) =>
    c.action == ScanAction.add || (c.action == ScanAction.restock && d.inventoryMatch == InventoryMatch.name);

class ScanProblems extends Equatable {
  const ScanProblems({this.quantity = false, this.name = false, this.price = false});

  factory ScanProblems.of(ScanChoice c) {
    if (c.action == ScanAction.skip) return const ScanProblems();
    final adding = c.action == ScanAction.add;
    return ScanProblems(
      quantity: !_count.hasMatch(c.quantity.trim()),
      name: adding && c.name.trim().isEmpty,
      price: adding && !_naira.hasMatch(c.price.trim()),
    );
  }

  final bool quantity;
  final bool name;
  final bool price;

  bool get any => quantity || name || price;

  @override
  List<Object?> get props => [quantity, name, price];
}

/// The API's confirm decision for one line.
Map<String, Object?> toDecision(ScanDetection d, ScanChoice c) {
  if (c.action == ScanAction.skip) return {'detectionId': d.id, 'action': 'skip'};
  final quantity = int.parse(c.quantity.trim());
  final qid = c.choice == ScanChoice.newItem ? null : c.choice;
  if (c.action == ScanAction.add) {
    return {
      'detectionId': d.id,
      'action': 'add',
      'name': c.name.trim(),
      'price': c.price.trim(),
      'quantity': quantity,
      'qid': ?qid,
    };
  }
  return {
    'detectionId': d.id,
    'action': c.action.name,
    'itemId': d.inventoryItemId,
    'quantity': quantity,
    // Restocking a hand-typed item (found by name) with a catalogue pick links it, so later scans match exactly.
    if (c.action == ScanAction.restock && d.inventoryMatch == InventoryMatch.name && qid != null) 'qid': qid,
  };
}

enum StoreTone { green, amber, gray }

/// What the merchant already stocks for this line, as a short status.
(String, StoreTone) storeStatus(ScanDetection d) {
  if (d.inventoryItemId == null) return ('Not in store', StoreTone.gray);
  final item = d.candidates.where((c) => c.inventoryItemId == d.inventoryItemId).firstOrNull;
  if (d.inventoryItemArchived) return ('You removed ${item?.label ?? 'this item'}. Restore?', StoreTone.amber);
  if (d.inventoryNeedsConfirm) return ('Is this your ${item?.label ?? 'item'}?', StoreTone.amber);
  return (d.inventoryMatch == InventoryMatch.reading ? 'In store (seen before)' : 'In store', StoreTone.green);
}

/// A merchant-readable line for one agent step (as mp's `describe`); the second part is the API's own summary.
(String, String?) describeStep(AgentStep s) {
  if (s.kind == 'baseline') {
    return (s.summary.replaceFirst(RegExp('^First pass:'), 'First pass done:'), 'Now checking the unclear lines');
  }
  if (s.kind == 'thought') return (s.summary.length > 160 ? '${s.summary.substring(0, 160)}…' : s.summary, null);
  switch (s.tool) {
    case 'zoom':
      return ('Zooming into a label', s.summary);
    case 'search_catalogue':
      final m = RegExp(r'^search "(.*)" → (\d+)').firstMatch(s.summary);
      if (m == null) return ('Searching catalogue', s.summary);
      return ('Searching catalogue for “${m[1]}”', '${m[2]} plausible match${m[2] == '1' ? '' : 'es'}');
    case 'find_in_store':
      return ('Checking your store', s.summary);
    case 'count_units':
      final m = RegExp(r'^count "(.*)" → (\d+)').firstMatch(s.summary);
      return m == null ? ('Counting units', s.summary) : ('Counting “${m[1]}”', '${m[2]} found');
    case 'record_line':
      return ('Recording a line', s.summary);
    case 'submit_stocktake':
      return ('Finishing the stock-take', s.summary);
    default:
      return (s.tool ?? 'Working', s.summary);
  }
}
