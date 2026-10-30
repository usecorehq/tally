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

/// Lines still to decide, agent-flagged first; lines confirmed earlier (a partial confirm) stay as they are.
List<ScanDetection> reviewOrder(List<ScanDetection> detections) => [
  ...detections.where((d) => d.decision == null && d.review != null),
  ...detections.where((d) => d.decision == null && d.review == null),
];

/// Lines confirmed earlier, which the review doesn't show again.
int countDecidedEarlier(List<ScanDetection> detections) => detections.where((d) => d.decision != null).length;

/// The line's starting pick (vision-recognition.md, "Showing a line"): no suggestions → a new item; a review
/// reason or a low top match → nothing picked; otherwise the top suggestion (a stored one without a match is medium).
String? initialPick(ScanDetection d) {
  final top = d.candidates.firstOrNull;
  if (top == null) return ScanChoice.newItem;
  if (d.review != null) return null;
  if ((top.match ?? MatchStrength.medium) == MatchStrength.low) return null;
  return top.qid;
}

/// Never pre-choose changing stock on a line that asks "Is this your item?", or is flagged and wasn't matched by
/// a branded reading the merchant already confirmed.
ScanAction? initialAction(ScanDetection d) {
  final first = actionsFor(d).first;
  final unsure =
      (first == ScanAction.restock || first == ScanAction.restore) &&
      (d.inventoryNeedsConfirm || (d.review != null && d.inventoryMatch != InventoryMatch.reading));
  return unsure ? null : first;
}

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

  factory ScanChoice.initial(ScanDetection d) {
    final pick = initialPick(d);
    final product = d.candidates.where((c) => c.qid == pick).firstOrNull;
    return ScanChoice(
      action: initialAction(d),
      quantity: '${d.count}',
      choice: pick,
      name: product?.label ?? d.reading,
      price: product?.priceMedian?.toString() ?? '',
    );
  }

  /// Null until the merchant chooses (an unsure restock or restore).
  final ScanAction? action;
  final String quantity;

  /// A Qore ID, [newItem], or null when nothing is picked yet.
  final String? choice;

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

  /// [copyWith] can't clear the action; this can.
  ScanChoice withAction(ScanAction? action) =>
      ScanChoice(action: action, quantity: quantity, choice: choice, name: name, price: price);

  @override
  List<Object?> get props => [action, quantity, choice, name, price];
}

/// Picking a product renames the line after it and, when it has one, resets the price to its typical price.
/// "New item" names it from the label and clears a price that came from the previous product.
ScanChoice chooseProduct(ScanDetection d, ScanChoice c, String choice) {
  if (choice == ScanChoice.newItem) {
    final hadProduct = c.choice != null && c.choice != ScanChoice.newItem;
    return c.copyWith(choice: choice, name: d.reading, price: hadProduct ? '' : c.price);
  }
  final next = d.candidates.where((x) => x.qid == choice).firstOrNull;
  return c.copyWith(choice: choice, name: next?.label, price: next?.priceMedian?.toString());
}

/// The picked suggestion, if the pick is one of the line's candidates.
ScanCandidate? pickedCandidate(ScanDetection d, ScanChoice c) =>
    d.candidates.where((x) => x.qid == c.choice).firstOrNull;

/// Whether the product picker applies: adding, or restocking an item found only by its name (links it).
bool productEditable(ScanDetection d, ScanChoice c) =>
    c.action == ScanAction.add || (c.action == ScanAction.restock && d.inventoryMatch == InventoryMatch.name);

/// Restore, or restock of a matched item: nothing to pick, the store's own item is shown instead.
bool storeItemLocked(ScanDetection d, ScanChoice c) =>
    c.action == ScanAction.restore || (c.action == ScanAction.restock && d.inventoryMatch != InventoryMatch.name);

/// The store item a locked restock or restore changes.
String storeItemName(ScanDetection d) {
  final item = d.inventoryItemId == null
      ? null
      : d.candidates.where((c) => c.inventoryItemId == d.inventoryItemId).firstOrNull;
  return item?.label ?? d.inventoryItemName ?? 'Your item in store';
}

/// A medium pick on a line not in store: ask "Is this your item?".
bool asksIsThisYourItem(ScanDetection d, ScanChoice c) =>
    d.inventoryItemId == null && pickedCandidate(d, c)?.match == MatchStrength.medium;

class ScanProblems extends Equatable {
  const ScanProblems({
    this.action = false,
    this.quantity = false,
    this.name = false,
    this.price = false,
    this.product = false,
  });

  factory ScanProblems.of(ScanChoice c) {
    if (c.action == null) return const ScanProblems(action: true);
    if (c.action == ScanAction.skip) return const ScanProblems();
    final adding = c.action == ScanAction.add;
    return ScanProblems(
      quantity: !_count.hasMatch(c.quantity.trim()),
      name: adding && c.name.trim().isEmpty,
      price: adding && !_naira.hasMatch(c.price.trim()),
      product: adding && c.choice == null,
    );
  }

  /// No action chosen yet.
  final bool action;
  final bool quantity;
  final bool name;
  final bool price;

  /// Adding with no product or "New item" picked.
  final bool product;

  bool get any => action || quantity || name || price || product;

  @override
  List<Object?> get props => [action, quantity, name, price, product];
}

/// The API's confirm decision for one line. Only for a line that passed [ScanProblems].
Map<String, Object?> toDecision(ScanDetection d, ScanChoice c) {
  final action = c.action!;
  if (action == ScanAction.skip) return {'detectionId': d.id, 'action': 'skip'};
  final quantity = int.parse(c.quantity.trim());
  final qid = c.choice == null || c.choice == ScanChoice.newItem ? null : c.choice;
  if (action == ScanAction.add) {
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
    'action': action.name,
    'itemId': d.inventoryItemId,
    'quantity': quantity,
    // Restocking a hand-typed item (found by name) with a catalogue pick links it, so later scans match exactly.
    if (action == ScanAction.restock && d.inventoryMatch == InventoryMatch.name && qid != null) 'qid': qid,
  };
}

/// "Choose restock, add or skip": the hint on a line with no action yet.
String chooseActionHint(ScanDetection d) {
  final names = actionsFor(d).map((a) => a.name).toList();
  return 'Not sure it\'s your item. Choose ${names.sublist(0, names.length - 1).join(', ')} or ${names.last}.';
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
      final m = RegExp(r'^read the label of "(.*)" up close$').firstMatch(s.summary);
      return m == null ? ('Zooming into a label', s.summary) : ('Zooming into “${m[1]}”', 'Reading the label up close');
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
