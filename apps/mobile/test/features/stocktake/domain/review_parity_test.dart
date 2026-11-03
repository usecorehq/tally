import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/scan_review.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/stocktake_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/scan_review_cubit.dart';

class _Confirm extends Mock implements ConfirmScan {}

// apps/mp's review-table rules: initialPick, initialState, rowProblems and the "to choose" summary.

const _strong = ScanCandidate(
  qid: 'QC-1',
  name: 'Brand A Drink 50cl',
  score: 0.9,
  priceMedian: 500,
  match: MatchStrength.strong,
);
const _medium = ScanCandidate(
  qid: 'QC-2',
  name: 'Brand A Drink 1l',
  score: 0.7,
  priceMedian: 900,
  match: MatchStrength.medium,
);
const _low = ScanCandidate(
  qid: 'QC-3',
  name: 'Other Product',
  score: 0.3,
  priceMedian: 11499,
  match: MatchStrength.low,
);

ScanDetection _line({
  String id = 'd',
  List<ScanCandidate> candidates = const [],
  String? review,
  String? itemId,
  InventoryMatch? match,
  bool needsConfirm = false,
  bool archived = false,
  String? itemName,
  LineDecision? decision,
}) => ScanDetection(
  id: id,
  brand: 'Brand A',
  name: 'Drink',
  pack: '50cl',
  count: 4,
  candidates: candidates,
  review: review,
  inventoryItemId: itemId,
  inventoryMatch: match,
  inventoryNeedsConfirm: needsConfirm,
  inventoryItemArchived: archived,
  inventoryItemName: itemName,
  decision: decision,
);

void main() {
  setUpAll(
    () => registerFallbackValue(const ConfirmScanParams(businessId: '', scanId: '', detections: [], choices: {})),
  );

  group('initial pick', () {
    test('no candidates: a new item named from the label', () {
      final c = ScanChoice.initial(_line());
      expect(c.choice, ScanChoice.newItem);
      expect(c.name, 'Brand A Drink 50cl');
      expect(c.price, '');
    });

    test('strong and medium pre-pick with the median; a stored candidate without a match counts as medium', () {
      expect(ScanChoice.initial(_line(candidates: [_strong])).price, '500');
      expect(ScanChoice.initial(_line(candidates: [_medium])).choice, 'QC-2');
      const stored = ScanCandidate(qid: 'QC-9', score: 0.8);
      expect(ScanChoice.initial(_line(candidates: [stored])).choice, 'QC-9');
    });

    test('a low top match or a review reason picks nothing; the name is the reading, no price', () {
      for (final d in [
        _line(candidates: [_low, _strong]),
        _line(candidates: [_strong], review: 'label unreadable'),
      ]) {
        final c = ScanChoice.initial(d);
        expect(c.choice, isNull);
        expect(c.name, 'Brand A Drink 50cl');
        expect(c.price, '');
        expect(ScanProblems.of(c).product, isTrue, reason: 'adding needs a product or "New item"');
      }
    });
  });

  group('unsure restock', () {
    test('"Is this your item?" or a flagged non-reading match starts with no action', () {
      expect(ScanChoice.initial(_line(itemId: 'i', match: InventoryMatch.name, needsConfirm: true)).action, isNull);
      expect(
        ScanChoice.initial(_line(itemId: 'i', match: InventoryMatch.catalogue, review: 'two sizes')).action,
        isNull,
      );
      expect(
        ScanChoice.initial(
          _line(itemId: 'i', archived: true, match: InventoryMatch.catalogue, needsConfirm: true),
        ).action,
        isNull,
      );
    });

    test('a remembered reading, or no doubt, restocks', () {
      expect(
        ScanChoice.initial(_line(itemId: 'i', match: InventoryMatch.reading, review: 'x')).action,
        ScanAction.restock,
      );
      expect(ScanChoice.initial(_line(itemId: 'i', match: InventoryMatch.catalogue)).action, ScanAction.restock);
      expect(ScanChoice.initial(_line(needsConfirm: true)).action, ScanAction.add, reason: 'not in store: add is safe');
    });

    test('no action is a problem, and the hint names the choices', () {
      final d = _line(itemId: 'i', match: InventoryMatch.name, needsConfirm: true);
      final c = ScanChoice.initial(d);
      expect(ScanProblems.of(c), const ScanProblems(action: true));
      expect(chooseActionHint(d), "Not sure it's your item. Choose restock, add or skip.");
    });
  });

  test('new item clears a price that came from a product; picking a candidate sets name and median', () {
    final d = _line(candidates: [_strong, _medium]);
    final own = chooseProduct(d, ScanChoice.initial(d), ScanChoice.newItem);
    expect(own.name, 'Brand A Drink 50cl');
    expect(own.price, '');
    final typed = chooseProduct(d, own.copyWith(price: '650'), ScanChoice.newItem);
    expect(typed.price, '650', reason: 'the merchant\'s own price stays');
    final picked = chooseProduct(d, typed, 'QC-2');
    expect((picked.name, picked.price), ('Brand A Drink 1l', '900'));
  });

  test('store item name, locked lines and "Is this your item?"', () {
    const inStore = ScanCandidate(qid: 'QC-1', name: 'Brand A Drink 50cl', score: 1, inventoryItemId: 'i');
    expect(storeItemName(_line(itemId: 'i', candidates: [inStore])), 'Brand A Drink 50cl');
    expect(storeItemName(_line(itemId: 'i', itemName: 'My drink')), 'My drink');
    expect(storeItemName(_line(itemId: 'i')), 'Your item in store');

    final restock = _line(itemId: 'i', match: InventoryMatch.catalogue);
    expect(storeItemLocked(restock, ScanChoice.initial(restock)), isTrue);
    final byName = _line(itemId: 'i', match: InventoryMatch.name);
    expect(storeItemLocked(byName, ScanChoice.initial(byName)), isFalse);

    final medium = _line(candidates: [_medium]);
    expect(asksIsThisYourItem(medium, ScanChoice.initial(medium)), isTrue);
    final strong = _line(candidates: [_strong]);
    expect(asksIsThisYourItem(strong, ScanChoice.initial(strong)), isFalse);
  });

  test('lines decided earlier are hidden and counted; flagged lines first', () {
    final decided = _line(
      id: 'done',
      decision: LineDecision(action: 'restock', itemId: 'i', quantity: 4, decidedAt: DateTime.utc(2026, 10, 29)),
    );
    final flagged = _line(id: 'f', review: 'two sizes');
    final plain = _line(id: 'p');
    expect(reviewOrder([plain, decided, flagged]).map((d) => d.id), ['f', 'p']);
    expect(countDecidedEarlier([plain, decided, flagged]), 1);
    final state = ScanReviewState.of(ShelfScan(scanId: 's', detections: [plain, decided, flagged]));
    expect(state.rows.length, 2);
    expect(state.decidedEarlier, 1);
  });

  test('the zoom step names the line', () {
    const zoom = AgentStep(turn: 2, kind: 'tool', tool: 'zoom', summary: 'read the label of "Brand A Drink" up close');
    expect(describeStep(zoom), ('Zooming into “Brand A Drink”', 'Reading the label up close'));
    const other = AgentStep(turn: 2, kind: 'tool', tool: 'zoom', summary: 'zoom line 0');
    expect(describeStep(other), ('Zooming into a label', 'zoom line 0'));
  });

  group('cubit', () {
    final unsure = _line(id: 'u', itemId: 'i', match: InventoryMatch.name, needsConfirm: true);
    final plain = _line(id: 'p', candidates: [_strong]);

    test('"to choose" counts lines with no action; counts skip them', () {
      final c = ScanReviewCubit(
        businessId: 'b',
        scan: ShelfScan(scanId: 's', detections: [unsure, plain]),
        confirm: _Confirm(),
      );
      expect(c.state.toChoose, 1);
      expect(c.state.counts[ScanAction.add], 1);
      expect(c.state.units, 4);
      c.setAction('u', ScanAction.restock);
      expect(c.state.toChoose, 0);
      expect(c.state.units, 8);
    });

    test('cards: accepting a line with no action flags it; after a skip it goes back to needing a choice', () {
      final c = ScanReviewCubit(
        businessId: 'b',
        scan: ShelfScan(scanId: 's', detections: [unsure]),
        confirm: _Confirm(),
      )..acceptCurrent();
      expect(c.state.cursor, 0);
      expect(c.state.flagged, {'u'});

      c
        ..skipCurrent()
        ..previous()
        ..acceptCurrent();
      expect(c.state.choices['u']!.action, isNull);
      expect(c.state.cursor, 0, reason: 'still needs a choice');

      c
        ..setAction('u', ScanAction.restock)
        ..acceptCurrent();
      expect(c.state.cursor, 1);
    });

    test('Confirm waits for every choice', () async {
      final confirm = _Confirm();
      when(
        () => confirm(any()),
      ).thenAnswer((_) async => const Right(ScanConfirmResult(created: 0, restocked: 1, restored: 0, skipped: 1)));
      final c = ScanReviewCubit(
        businessId: 'b',
        scan: ShelfScan(scanId: 's', detections: [unsure]),
        confirm: confirm,
      );
      await c.submit();
      expect(c.state.invalidIds, ['u']);
      verifyNever(() => confirm(any()));
      c.setAction('u', ScanAction.restock);
      await c.submit();
      expect(c.state.result?.restocked, 1);
    });
  });
}
