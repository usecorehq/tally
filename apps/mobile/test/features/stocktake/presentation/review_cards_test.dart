import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/scan_review.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/stocktake_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/scan_review_cubit.dart';

class _Confirm extends Mock implements ConfirmScan {}

// One by one: the same decisions as the list, a line at a time.

const _peak = ScanCandidate(qid: 'QC-1', name: 'Peak Milk 400g', score: 0.9, priceMedian: 4200);
const _matched = ScanDetection(id: 'a', brand: 'Peak', name: 'Milk', pack: '400g', count: 6, candidates: [_peak]);
const _unpriced = ScanDetection(id: 'b', brand: 'Zobo', name: 'Drink', pack: '', count: 3);
const _stocked = ScanDetection(id: 'c', brand: 'Milo', name: 'Refill', pack: '', count: 2, inventoryItemId: 'i1');
const _scan = ShelfScan(scanId: 's1', detections: [_matched, _unpriced, _stocked]);

void main() {
  setUpAll(
    () => registerFallbackValue(const ConfirmScanParams(businessId: '', scanId: '', detections: [], choices: {})),
  );

  ScanReviewCubit cubit() => ScanReviewCubit(businessId: 'b1', scan: _scan, confirm: _Confirm());

  test('opens one by one on the first line', () {
    final c = cubit();
    expect(c.state.mode, ReviewMode.cards);
    expect(c.state.current, _matched);
  });

  test('keep moves on; a line missing its price is flagged and stays', () {
    final c = cubit()..acceptCurrent();
    expect(c.state.current, _unpriced);

    c.acceptCurrent();
    expect(c.state.current, _unpriced, reason: 'no catalogue price to prefill');
    expect(c.state.flagged, {'b'});

    c
      ..setPrice('b', '500')
      ..acceptCurrent();
    expect(c.state.current, _stocked);
    expect(c.state.flagged, isEmpty);
  });

  test('skip, then back and keep, restores the default action', () {
    final c = cubit()..skipCurrent();
    expect(c.state.choices['a']!.action, ScanAction.skip);

    c
      ..previous()
      ..acceptCurrent();
    expect(c.state.choices['a']!.action, ScanAction.add);
    expect(c.state.cursor, 1);
  });

  test('all decided: the summary, and a line can be reopened', () {
    final c = cubit()
      ..acceptCurrent()
      ..skipCurrent()
      ..acceptCurrent();
    expect(c.state.current, isNull);
    expect(c.state.counts[ScanAction.restock], 1);
    expect(c.state.counts[ScanAction.skip], 1);

    c.goTo('b');
    expect(c.state.current, _unpriced);
  });

  test('switching to the list keeps every decision', () {
    final c = cubit()
      ..setQuantity('a', '9')
      ..acceptCurrent()
      ..setMode(ReviewMode.list);
    expect(c.state.mode, ReviewMode.list);
    expect(c.state.choices['a']!.quantity, '9');
    expect(c.state.cursor, 1);
  });

  test('confirm from the summary sends every line', () async {
    final confirm = _Confirm();
    when(
      () => confirm(any()),
    ).thenAnswer((_) async => const Right(ScanConfirmResult(created: 1, restocked: 1, restored: 0, skipped: 1)));
    final c = ScanReviewCubit(businessId: 'b1', scan: _scan, confirm: confirm)
      ..acceptCurrent()
      ..skipCurrent()
      ..acceptCurrent();
    await c.submit();
    final sent = verify(() => confirm(captureAny())).captured.single as ConfirmScanParams;
    expect(sent.detections.length, 3);
    expect(c.state.result?.restocked, 1);
  });
}
