import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/entities/stocktake_history.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/stocktake_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/history/cubit/session_cubit.dart';

class _Get extends Mock implements GetStocktake {}

class _Scan extends Mock implements GetScan {}

class _Rerun extends Mock implements RerunScan {}

class _Discard extends Mock implements DiscardScan {}

const _open = ShelfScan(scanId: 's1', detections: [], canRerun: true);
final _discarded = ShelfScan(
  scanId: 's1',
  detections: const [],
  status: ScanStatus.discarded,
  discardedAt: DateTime.utc(2026, 10, 29),
);
const _running = StocktakeRun(status: StocktakeStatus.running, runId: 'r1');
const _done = StocktakeRun(status: StocktakeStatus.done, runId: 'r1', result: _open);
const _poll = Duration(milliseconds: 10);

Future<void> _wait(int polls) => Future<void>.delayed(_poll * polls + const Duration(milliseconds: 20));

void main() {
  late _Get get;
  late _Scan scan;
  late _Rerun rerun;
  late _Discard discard;

  setUpAll(() {
    registerFallbackValue(const RunParams(businessId: 'b1', runId: 'r1'));
    registerFallbackValue(const ScanParams(businessId: 'b1', scanId: 's1'));
  });

  setUp(() {
    get = _Get();
    scan = _Scan();
    rerun = _Rerun();
    discard = _Discard();
  });

  SessionCubit cubit([String id = 'r1']) => SessionCubit(
    businessId: 'b1',
    id: id,
    getStocktake: get,
    getScan: scan,
    rerunScan: rerun,
    discardScan: discard,
    pollEvery: _poll,
  );

  test('a running run is polled until it ends, then shows its scan', () async {
    var polls = 0;
    when(() => get(any())).thenAnswer((_) async => Right(++polls < 3 ? _running : _done));
    final c = cubit();
    await c.load();
    expect(c.state, const SessionRunning(_running));
    await _wait(4);
    expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake));
    expect(polls, 3);
    await c.close();
  });

  test('a fallback run shows the first pass, flagged', () async {
    when(
      () => get(any()),
    ).thenAnswer((_) async => const Right(StocktakeRun(status: StocktakeStatus.fallback, result: _open)));
    final c = cubit();
    await c.load();
    expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake, fallback: true));
    await c.close();
  });

  test('no run with this id (404): the quick scan', () async {
    when(() => get(any())).thenAnswer((_) async => const Left(NotFoundFailure('No such run.')));
    when(() => scan(any())).thenAnswer((_) async => const Right(_open));
    final c = cubit('s1');
    await c.load();
    expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.quick));
    verify(() => scan(const ScanParams(businessId: 'b1', scanId: 's1'))).called(1);
    await c.close();
  });

  test('neither run nor scan: missing; another failure: retryable', () async {
    when(() => get(any())).thenAnswer((_) async => const Left(NotFoundFailure('No such run.')));
    when(() => scan(any())).thenAnswer((_) async => const Left(NotFoundFailure('No such scan.')));
    final c = cubit();
    await c.load();
    expect(c.state, const SessionLoadFailed('No such scan.', missing: true));

    when(() => get(any())).thenAnswer((_) async => const Left(ServerFailure('Offline.')));
    await c.load();
    expect(c.state, const SessionLoadFailed('Offline.'));
    await c.close();
  });

  test('a failed run, or one that ended without a result', () async {
    const failed = StocktakeRun(status: StocktakeStatus.failed, error: 'Timed out');
    when(() => get(any())).thenAnswer((_) async => const Right(failed));
    final c = cubit();
    await c.load();
    expect(c.state, const SessionRunFailed(failed));

    const empty = StocktakeRun(status: StocktakeStatus.done);
    when(() => get(any())).thenAnswer((_) async => const Right(empty));
    await c.load();
    expect(c.state, const SessionRunFailed(empty));
    await c.close();
  });

  test('5 failed polls in a row: lost track; retry picks it back up', () async {
    var calls = 0;
    when(() => get(any())).thenAnswer((_) async {
      calls++;
      return calls == 1 ? const Right(_running) : const Left(ServerFailure('Offline'));
    });
    final c = cubit();
    await c.load();
    await _wait(8);
    expect(c.state, const SessionRunning(_running, lostTrack: 'Offline'));
    expect(calls, 6);

    when(() => get(any())).thenAnswer((_) async => const Right(_done));
    c.retryPolling();
    expect(c.state, const SessionRunning(_running));
    await _wait(2);
    expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake));
    await c.close();
  });

  test('a failure between successes resets the count', () async {
    var calls = 0;
    when(() => get(any())).thenAnswer((_) async {
      calls++;
      if (calls == 1 || calls == 5) return const Right(_running);
      if (calls >= 10) return const Right(_done);
      return const Left(ServerFailure('Offline'));
    });
    final c = cubit();
    await c.load();
    await _wait(14);
    expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake));
    await c.close();
  });

  group('rerun', () {
    test('busy, then the new run to open', () async {
      when(() => get(any())).thenAnswer((_) async => const Right(_done));
      when(() => rerun(any())).thenAnswer((_) async => const Right(ScanRerun(runId: 'r2', rerunOf: 's1')));
      final c = cubit();
      await c.load();
      final states = <SessionState>[];
      final sub = c.stream.listen(states.add);
      await c.rerun();
      await Future<void>.delayed(Duration.zero);
      expect(states, [
        const SessionScan(scan: _open, kind: HistoryKind.stocktake, rerunning: true),
        const SessionScan(scan: _open, kind: HistoryKind.stocktake, rerunRunId: 'r2'),
      ]);
      c.rerunOpened();
      expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake));
      await sub.cancel();
      await c.close();
    });

    test("409: the API's message, inline", () async {
      when(() => get(any())).thenAnswer((_) async => const Right(_done));
      when(() => rerun(any())).thenAnswer((_) async => const Left(ConflictFailure('Take new stock instead.')));
      final c = cubit();
      await c.load();
      await c.rerun();
      expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake, error: 'Take new stock instead.'));
      await c.close();
    });
  });

  group('discard', () {
    test('success: the scan re-read, read-only', () async {
      when(() => get(any())).thenAnswer((_) async => const Right(_done));
      when(() => discard(any())).thenAnswer((_) async => Right(DateTime.utc(2026, 10, 29)));
      when(() => scan(any())).thenAnswer((_) async => Right(_discarded));
      final c = cubit();
      await c.load();
      expect(await c.discard(), isNull);
      expect(c.state, SessionScan(scan: _discarded, kind: HistoryKind.stocktake));
      await c.close();
    });

    test('success but the re-read failed: marked discarded locally', () async {
      when(() => get(any())).thenAnswer((_) async => const Right(_done));
      when(() => discard(any())).thenAnswer((_) async => Right(DateTime.utc(2026, 10, 29)));
      when(() => scan(any())).thenAnswer((_) async => const Left(ServerFailure('Offline.')));
      final c = cubit();
      await c.load();
      expect(await c.discard(), isNull);
      final s = (c.state as SessionScan).scan;
      expect(s.status, ScanStatus.discarded);
      expect(s.discardedAt, DateTime.utc(2026, 10, 29));
      await c.close();
    });

    test("409: the reason, and the scan unchanged", () async {
      when(() => get(any())).thenAnswer((_) async => const Right(_done));
      when(() => discard(any())).thenAnswer((_) async => const Left(ConflictFailure('Already confirmed.')));
      final c = cubit();
      await c.load();
      expect(await c.discard(), 'Already confirmed.');
      expect(c.state, const SessionScan(scan: _open, kind: HistoryKind.stocktake));
      await c.close();
    });
  });
}
