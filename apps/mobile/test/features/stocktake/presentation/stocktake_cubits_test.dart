import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/scan_review.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/stocktake_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/scan_review_cubit.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/shelf_scan_cubit.dart';

class _Quick extends Mock implements QuickScan {}

class _Start extends Mock implements StartStocktake {}

class _Get extends Mock implements GetStocktake {}

class _Confirm extends Mock implements ConfirmScan {}

final _photo = ShelfPhoto(bytes: Uint8List(10), mimeType: 'image/jpeg');
const _detection = ScanDetection(id: 'd1', brand: 'Peak', name: 'Milk', pack: '400g', count: 6);
const _scan = ShelfScan(scanId: 's1', detections: [_detection]);
const _step = AgentStep(turn: 1, kind: 'tool', tool: 'zoom', summary: 'zoom line 0');

void main() {
  late _Quick quick;
  late _Start start;
  late _Get get;

  setUpAll(() {
    registerFallbackValue(ScanPhotoParams(businessId: 'b1', photo: _photo));
    registerFallbackValue(const RunParams(businessId: 'b1', runId: 'r1'));
    registerFallbackValue(const ConfirmScanParams(businessId: '', scanId: '', detections: [], choices: {}));
  });

  setUp(() {
    quick = _Quick();
    start = _Start();
    get = _Get();
  });

  ShelfScanCubit cubit() => ShelfScanCubit(
    businessId: 'b1',
    quickScan: quick,
    startStocktake: start,
    getStocktake: get,
    pollEvery: Duration.zero,
  );

  test('quick scan: the scan to review, or the error with the photo kept', () async {
    when(() => quick(any())).thenAnswer((_) async => const Right(_scan));
    final c = cubit()..usePhoto(_photo);
    await c.quickScan();
    expect(c.state, ScanReady(photo: _photo, scan: _scan, fallback: false));

    when(() => quick(any())).thenAnswer((_) async => const Left(ServerFailure('Recognition is busy.')));
    c.usePhoto(_photo);
    await c.quickScan();
    expect(c.state, ScanPicking(photo: _photo, error: 'Recognition is busy.'));
  });

  test('agent: polls through steps and a blip, then the fallback result', () async {
    when(() => start(any())).thenAnswer((_) async => const Right('r1'));
    final replies = <Either<Failure, StocktakeRun>>[
      const Right(StocktakeRun(status: StocktakeStatus.running, steps: [_step])),
      const Left(ServerFailure('Check your connection and try again.')),
      const Right(StocktakeRun(status: StocktakeStatus.fallback, steps: [_step], result: _scan)),
    ];
    when(() => get(any())).thenAnswer((_) async => replies.removeAt(0));
    final c = cubit()..usePhoto(_photo);
    final seen = <ShelfScanState>[];
    final sub = c.stream.listen(seen.add);
    await c.stocktake();
    await sub.cancel();
    expect(seen.whereType<ScanWorking>().last.steps, [_step]);
    expect(c.state, ScanReady(photo: _photo, scan: _scan, fallback: true));
  });

  test('agent failed: say so and keep the photo', () async {
    when(() => start(any())).thenAnswer((_) async => const Right('r1'));
    when(
      () => get(any()),
    ).thenAnswer((_) async => const Right(StocktakeRun(status: StocktakeStatus.failed, error: 'First pass failed')));
    final c = cubit()..usePhoto(_photo);
    await c.stocktake();
    expect(
      c.state,
      ScanPicking(photo: _photo, error: 'The stock-take failed: First pass failed. Try again, or use Quick scan.'),
    );
  });

  test('cancel: a late reply is dropped', () async {
    when(() => quick(any())).thenAnswer((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return const Right(_scan);
    });
    final c = cubit()..usePhoto(_photo);
    final running = c.quickScan();
    c.cancel();
    await running;
    expect(c.state, ScanPicking(photo: _photo));
  });

  test('review: Confirm flags a bad line; a valid one sends every decision', () async {
    final confirm = _Confirm();
    when(
      () => confirm(any()),
    ).thenAnswer((_) async => const Right(ScanConfirmResult(created: 1, restocked: 0, restored: 0, skipped: 0)));
    final c = ScanReviewCubit(businessId: 'b1', scan: _scan, confirm: confirm);
    // No catalogue match: adding needs a price.
    await c.submit();
    expect(c.state.attempted, isTrue);
    expect(c.state.invalidIds, ['d1']);
    verifyNever(() => confirm(any()));

    c.setPrice('d1', '4500');
    expect(c.state.units, 6);
    await c.submit();
    final sent = verify(() => confirm(captureAny())).captured.single as ConfirmScanParams;
    expect(sent.choices['d1']!.action, ScanAction.add);
    expect(c.state.result?.created, 1);
  });
}
