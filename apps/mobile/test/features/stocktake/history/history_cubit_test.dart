import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/stocktake/domain/entities/stocktake_history.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/stocktake_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/history/cubit/history_cubit.dart';

class _History extends Mock implements GetStocktakeHistory {}

class _Discard extends Mock implements DiscardScan {}

HistoryEntry _entry(String id, HistoryStatus status, {List<HistoryEntry> reruns = const []}) => HistoryEntry(
  id: id,
  kind: HistoryKind.stocktake,
  scanId: 's-$id',
  status: status,
  startedAt: DateTime.utc(2026, 10, 29, 9),
  lines: 2,
  reruns: reruns,
);

const _poll = Duration(milliseconds: 20);

Future<void> _wait([int polls = 1]) => Future<void>.delayed(_poll * polls + const Duration(milliseconds: 15));

void main() {
  late _History history;
  late _Discard discard;

  setUpAll(() {
    registerFallbackValue(const HistoryParams(businessId: 'b1'));
    registerFallbackValue(const ScanParams(businessId: 'b1', scanId: 's'));
  });

  setUp(() {
    history = _History();
    discard = _Discard();
  });

  HistoryCubit cubit() => HistoryCubit(businessId: 'b1', getHistory: history, discardScan: discard, pollEvery: _poll);

  test('load: the entries, grouped by day', () async {
    final done = _entry('a', HistoryStatus.confirmed);
    when(() => history(any())).thenAnswer((_) async => Right([done]));
    final c = cubit();
    await c.load();
    expect(c.state, HistoryLoaded([done]));
    expect((c.state as HistoryLoaded).days.single.entries, [done]);
    await c.close();
  });

  test('load: empty only after a successful empty read', () async {
    when(() => history(any())).thenAnswer((_) async => const Right([]));
    final c = cubit();
    expect(c.state, const HistoryLoading());
    await c.load();
    expect(c.state, const HistoryLoaded([]));
    await c.close();
  });

  test('load: failed with the reason; retry recovers', () async {
    when(() => history(any())).thenAnswer((_) async => const Left(ServerFailure('Offline.')));
    final c = cubit();
    await c.load();
    expect(c.state, const HistoryFailed('Offline.'));
    when(() => history(any())).thenAnswer((_) async => const Right([]));
    await c.load();
    expect(c.state, const HistoryLoaded([]));
    await c.close();
  });

  test('polls while an entry (or a nested rerun) is running, and stops once none is', () async {
    final running = _entry('a', HistoryStatus.review, reruns: [_entry('r', HistoryStatus.running)]);
    final settled = _entry('a', HistoryStatus.review, reruns: [_entry('r', HistoryStatus.review)]);
    var reads = 0;
    when(() => history(any())).thenAnswer((_) async => Right(++reads < 3 ? [running] : [settled]));
    final c = cubit();
    await c.load();
    await _wait(4);
    expect(reads, 3);
    expect(c.state, HistoryLoaded([settled]));
    await _wait(3);
    expect(reads, 3);
    await c.close();
  });

  test('a failed poll keeps the list and keeps polling', () async {
    final running = _entry('a', HistoryStatus.running);
    var reads = 0;
    when(
      () => history(any()),
    ).thenAnswer((_) async => ++reads == 2 ? const Left(ServerFailure('Blip.')) : Right([running]));
    final c = cubit();
    await c.load();
    await _wait(3);
    expect(reads, greaterThanOrEqualTo(3));
    expect(c.state, HistoryLoaded([running]));
    await c.close();
  });

  test('a hidden tab stops polling; showing it re-reads', () async {
    var reads = 0;
    when(() => history(any())).thenAnswer((_) async {
      reads++;
      return Right([_entry('a', HistoryStatus.running)]);
    });
    final c = cubit();
    await c.load();
    c.setActive(false);
    await _wait(3);
    expect(reads, 1);
    c.setActive(true);
    await _wait(0);
    expect(reads, 2);
    await c.close();
  });

  test('discard: null and a re-read on success; the reason on 409', () async {
    when(() => history(any())).thenAnswer((_) async => Right([_entry('a', HistoryStatus.review)]));
    when(() => discard(any())).thenAnswer((_) async => Right(DateTime.utc(2026)));
    final c = cubit();
    await c.load();
    expect(await c.discard('s-a'), isNull);
    await _wait(0);
    verify(() => history(any())).called(2);
    verify(() => discard(const ScanParams(businessId: 'b1', scanId: 's-a'))).called(1);

    when(() => discard(any())).thenAnswer((_) async => const Left(ConflictFailure('Already confirmed.')));
    expect(await c.discard('s-a'), 'Already confirmed.');
    await c.close();
  });
}
