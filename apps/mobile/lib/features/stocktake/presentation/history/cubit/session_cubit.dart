import 'package:dartz/dartz.dart' show Left, Right;
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/error/failures.dart';
import '../../../domain/entities/shelf_scan.dart';
import '../../../domain/entities/stocktake_history.dart';
import '../../../domain/usecases/stocktake_usecases.dart';

sealed class SessionState extends Equatable {
  const SessionState();

  @override
  List<Object?> get props => [];
}

class SessionLoading extends SessionState {
  const SessionLoading();
}

/// [missing]: no run or scan with this id for the business (a wrong link or another business).
class SessionLoadFailed extends SessionState {
  const SessionLoadFailed(this.message, {this.missing = false});
  final String message;
  final bool missing;

  @override
  List<Object?> get props => [message, missing];
}

/// The agent is still working. [lostTrack]: the last polls all failed; it keeps running on the server.
class SessionRunning extends SessionState {
  const SessionRunning(this.run, {this.lostTrack});
  final StocktakeRun run;
  final String? lostTrack;

  @override
  List<Object?> get props => [run, lostTrack];
}

class SessionRunFailed extends SessionState {
  const SessionRunFailed(this.run);
  final StocktakeRun run;

  @override
  List<Object?> get props => [run];
}

/// A scan to review (open) or read (confirmed, discarded, superseded).
class SessionScan extends SessionState {
  const SessionScan({
    required this.scan,
    required this.kind,
    this.fallback = false,
    this.rerunning = false,
    this.error,
    this.rerunRunId,
  });
  final ShelfScan scan;
  final HistoryKind kind;

  /// The agent stopped; the result is the first pass.
  final bool fallback;
  final bool rerunning;

  /// A failed rerun's reason (409: no photo kept, or a run of it already moved stock).
  final String? error;

  /// A rerun started: the page opens it, then calls [SessionCubit.rerunOpened].
  final String? rerunRunId;

  SessionScan _with({ShelfScan? scan, bool rerunning = false, String? error, String? rerunRunId}) => SessionScan(
    scan: scan ?? this.scan,
    kind: kind,
    fallback: fallback,
    rerunning: rerunning,
    error: error,
    rerunRunId: rerunRunId,
  );

  @override
  List<Object?> get props => [scan, kind, fallback, rerunning, error, rerunRunId];
}

/// One stock-take session by id, as apps/mp's /stocktake/history/[id]: a run (polled until it ends),
/// or, when no run has this id, a quick scan. Per session: `sl<SessionCubit>(param1: businessId, param2: id)`.
class SessionCubit extends Cubit<SessionState> {
  SessionCubit({
    required this.businessId,
    required this.id,
    required GetStocktake getStocktake,
    required GetScan getScan,
    required RerunScan rerunScan,
    required DiscardScan discardScan,
    this.pollEvery = const Duration(milliseconds: 1500),
    this.maxPollFailures = 5,
  }) : _getStocktake = getStocktake,
       _getScan = getScan,
       _rerun = rerunScan,
       _discard = discardScan,
       super(const SessionLoading());

  final String businessId;

  /// A run id or a quick scan's id.
  final String id;
  final GetStocktake _getStocktake;
  final GetScan _getScan;
  final RerunScan _rerun;
  final DiscardScan _discard;
  final Duration pollEvery;
  final int maxPollFailures;

  /// Bumped per load: an older poll loop stops.
  int _gen = 0;

  /// [quiet]: re-read without the skeleton (coming back from another screen).
  Future<void> load({bool quiet = false}) async {
    final gen = ++_gen;
    if (!quiet || state is SessionLoadFailed) emit(const SessionLoading());
    final run = await _getStocktake(RunParams(businessId: businessId, runId: id));
    if (_stale(gen)) return;
    switch (run) {
      case Right(value: final r):
        _show(r, gen);
      case Left(value: NotFoundFailure()):
        final scan = await _getScan(ScanParams(businessId: businessId, scanId: id));
        if (_stale(gen)) return;
        emit(
          scan.fold(
            (f) => SessionLoadFailed(f.message, missing: f is NotFoundFailure),
            (s) => SessionScan(scan: s, kind: HistoryKind.quick),
          ),
        );
      case Left(value: final f):
        emit(SessionLoadFailed(f.message));
    }
  }

  /// After "we lost track": pick the run back up.
  void retryPolling() {
    final s = state;
    if (s is! SessionRunning) return;
    emit(SessionRunning(s.run));
    _poll(++_gen, s.run);
  }

  Future<void> rerun() async {
    final s = state;
    if (s is! SessionScan || s.rerunning) return;
    emit(s._with(rerunning: true));
    final result = await _rerun(ScanParams(businessId: businessId, scanId: s.scan.scanId));
    if (isClosed) return;
    final now = state;
    if (now is! SessionScan) return;
    emit(result.fold((f) => now._with(error: f.message), (r) => now._with(rerunRunId: r.runId)));
  }

  /// The page opened the new run.
  void rerunOpened() {
    final s = state;
    if (s is SessionScan && s.rerunRunId != null) emit(s._with());
  }

  /// Null once discarded (the session becomes read-only), else the API's reason for the dialog.
  Future<String?> discard() async {
    final s = state;
    if (s is! SessionScan) return null;
    final params = ScanParams(businessId: businessId, scanId: s.scan.scanId);
    final result = await _discard(params);
    if (isClosed) return null;
    final failure = result.fold((f) => f, (_) => null);
    if (failure != null) return failure.message;
    final fresh = await _getScan(params);
    if (isClosed) return null;
    final now = state;
    if (now is SessionScan) {
      emit(now._with(scan: fresh.fold((_) => _discarded(now.scan, result.getOrElse(() => null)), (x) => x)));
    }
    return null;
  }

  void _show(StocktakeRun run, int gen) {
    switch (run.status) {
      case StocktakeStatus.running:
        emit(SessionRunning(run));
        _poll(gen, run);
      case StocktakeStatus.failed:
        emit(SessionRunFailed(run));
      case StocktakeStatus.done || StocktakeStatus.fallback:
        final scan = run.result;
        emit(
          scan == null
              ? SessionRunFailed(run)
              : SessionScan(scan: scan, kind: HistoryKind.stocktake, fallback: run.status == StocktakeStatus.fallback),
        );
    }
  }

  Future<void> _poll(int gen, StocktakeRun last) async {
    var failures = 0;
    while (true) {
      await Future<void>.delayed(pollEvery);
      if (_stale(gen)) return;
      final result = await _getStocktake(RunParams(businessId: businessId, runId: id));
      if (_stale(gen)) return;
      switch (result) {
        case Left(value: final f):
          if (++failures >= maxPollFailures) {
            emit(SessionRunning(last, lostTrack: f.message));
            return;
          }
        case Right(value: final run):
          failures = 0;
          last = run;
          if (run.status != StocktakeStatus.running) {
            _show(run, gen);
            return;
          }
          emit(SessionRunning(run));
      }
    }
  }

  bool _stale(int gen) => isClosed || gen != _gen;

  /// The discard landed but the re-read didn't: show it read-only all the same.
  static ShelfScan _discarded(ShelfScan s, DateTime? at) => ShelfScan(
    scanId: s.scanId,
    detections: s.detections,
    catalogueAvailable: s.catalogueAvailable,
    status: ScanStatus.discarded,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
    discardedAt: at ?? DateTime.now(),
    supersededAt: s.supersededAt,
    rerunOf: s.rerunOf,
    canRerun: s.canRerun,
    candidateDetails: s.candidateDetails,
    photoUrl: s.photoUrl,
    photoStored: s.photoStored,
  );

  @override
  Future<void> close() {
    _gen++;
    return super.close();
  }
}
