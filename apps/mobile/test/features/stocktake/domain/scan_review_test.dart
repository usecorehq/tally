import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/features/stocktake/data/models/shelf_scan_model.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/scan_review.dart';

// Same confirm body as apps/mp's review table, line for line.

const _peak = ScanCandidate(
  qid: 'QC-7K2M-9XQ4-R',
  name: 'Peak Full Cream Milk Powder 400g',
  score: 0.94,
  priceMedian: 4500,
);
const _dano = ScanCandidate(qid: 'QC-8M3N-2PQ5-S', name: 'Dano Cool Cow 400g', score: 0.6, priceMedian: 3900);

const _new = ScanDetection(
  id: 'd-new',
  brand: 'Peak',
  name: 'Full Cream Milk Powder',
  pack: '400g',
  count: 6,
  candidates: [_peak, _dano],
);
const _stocked = ScanDetection(
  id: 'd-stocked',
  brand: 'Peak',
  name: 'Full Cream Milk Powder',
  pack: '400g',
  count: 4,
  candidates: [_peak],
  inventoryItemId: 'item-1',
  inventoryMatch: InventoryMatch.name,
);

void main() {
  test('in store restocks, removed restores, otherwise add; skip is always there', () {
    expect(actionsFor(_new), [ScanAction.add, ScanAction.skip]);
    expect(actionsFor(_stocked), [ScanAction.restock, ScanAction.add, ScanAction.skip]);
    const removed = ScanDetection(
      id: 'r',
      brand: '',
      name: 'x',
      pack: '',
      count: 1,
      inventoryItemId: 'i',
      inventoryItemArchived: true,
    );
    expect(actionsFor(removed).first, ScanAction.restore);
  });

  test('a new product: add the top match at its typical price, with the counted units', () {
    final c = ScanChoice.initial(_new);
    expect(toDecision(_new, c), {
      'detectionId': 'd-new',
      'action': 'add',
      'name': 'Peak Full Cream Milk Powder 400g',
      'price': '4500',
      'quantity': 6,
      'qid': 'QC-7K2M-9XQ4-R',
    });
  });

  test('picking another product renames and reprices; a new item sends no Qore ID', () {
    final picked = chooseProduct(_new, ScanChoice.initial(_new), _dano.qid);
    expect(picked.name, 'Dano Cool Cow 400g');
    expect(picked.price, '3900');
    final own = chooseProduct(_new, picked, ScanChoice.newItem).copyWith(price: '4000');
    expect(own.name, 'Peak Full Cream Milk Powder 400g');
    expect(toDecision(_new, own).containsKey('qid'), isFalse);
  });

  test('restocking a name-matched item links the pick; skip sends only the decision', () {
    final c = ScanChoice.initial(_stocked).copyWith(quantity: '5');
    expect(toDecision(_stocked, c), {
      'detectionId': 'd-stocked',
      'action': 'restock',
      'itemId': 'item-1',
      'quantity': 5,
      'qid': 'QC-7K2M-9XQ4-R',
    });
    expect(productEditable(_stocked, c), isTrue);
    expect(toDecision(_stocked, c.copyWith(action: ScanAction.skip)), {'detectionId': 'd-stocked', 'action': 'skip'});
  });

  test('problems: a whole count; a name and a Naira price only when adding', () {
    final c = ScanChoice.initial(_new);
    expect(ScanProblems.of(c).any, isFalse);
    expect(ScanProblems.of(c.copyWith(quantity: '2.5')).quantity, isTrue);
    expect(ScanProblems.of(c.copyWith(price: '45.005')).price, isTrue);
    expect(ScanProblems.of(c.copyWith(name: ' ')).name, isTrue);
    expect(ScanProblems.of(c.copyWith(action: ScanAction.skip, quantity: '')).any, isFalse);
  });

  test('store status and agent-flagged lines first', () {
    expect(storeStatus(_new), ('Not in store', StoreTone.gray));
    const confirm = ScanDetection(
      id: 'c',
      brand: 'Peak',
      name: 'Milk',
      pack: '',
      count: 1,
      candidates: [ScanCandidate(qid: 'QC-1', name: 'Peak Milk', score: 1, inventoryItemId: 'i')],
      inventoryItemId: 'i',
      inventoryNeedsConfirm: true,
    );
    expect(storeStatus(confirm), ('Is this your Peak Milk?', StoreTone.amber));
    const flagged = ScanDetection(id: 'f', brand: '', name: 'x', pack: '', count: 1, review: 'two sizes');
    expect(reviewOrder([_new, flagged]).map((d) => d.id), ['f', 'd-new']);
  });

  test('the API example parses: boxes, counts, prices in whole Naira', () {
    final scan = shelfScanFromJson({
      'scanId': 's1',
      'catalogueAvailable': true,
      'detections': [
        {
          'id': 'd1',
          'brand': 'Peak',
          'name': 'Full Cream Milk Powder',
          'pack': '400g',
          'look': 'yellow tin',
          'count': 6,
          'countSource': 'sam',
          'sparkCount': 5,
          'samCount': 6,
          'boxes': [
            {'x1': 102, 'y1': 210, 'x2': 180, 'y2': 395},
          ],
          'confidence': 'high',
          'inventoryItemId': null,
          'inventoryMatch': null,
          'inventoryItemArchived': false,
          'inventoryNeedsConfirm': false,
          'candidates': [
            {
              'qid': 'QC-7K2M-9XQ4-R',
              'name': 'Peak Full Cream Milk Powder',
              'score': 0.94,
              'price': {'median': 4500, 'min': 4200, 'max': 5100},
            },
          ],
        },
      ],
    });
    final d = scan.detections.single;
    expect(d.reading, 'Peak Full Cream Milk Powder 400g');
    expect(d.countedBySam, isTrue);
    expect(d.boxes.single, const ScanBox(102, 210, 180, 395));
    expect(d.candidates.single.priceMax, 5100);
    expect(d.inventoryMatch, isNull);
  });

  test('a stock-take run and a confirm result parse', () {
    final run = stocktakeRunFromJson({
      'run': {'id': 'r1', 'status': 'fallback', 'scanId': 's1', 'turns': 3, 'error': null},
      'steps': [
        {'turn': 0, 'kind': 'baseline', 'tool': null, 'summary': 'First pass: 4 products', 'ms': 21000},
      ],
      'result': {'scanId': 's1', 'detections': []},
    });
    expect(run.status, StocktakeStatus.fallback);
    expect(describeStep(run.steps.single), ('First pass done: 4 products', 'Now checking the unclear lines'));
    final r = confirmResultFromJson({
      'created': 2,
      'restocked': 3,
      'restored': 0,
      'skipped': 1,
      'alreadyDecided': 0,
      'invalid': [
        {'detectionId': 'd9', 'reason': 'item not found'},
      ],
      'scanConfirmed': true,
      'feedback': {'sent': 0, 'error': 'catalogue down'},
      'images': {'uploaded': 0, 'skipped': 6, 'failed': 0},
    });
    expect(r.invalid.single, ('d9', 'item not found'));
    expect(r.feedbackError, 'catalogue down');
  });
}
