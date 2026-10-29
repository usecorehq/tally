import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/shelf_scan.dart';
import '../../domain/usecases/stocktake_usecases.dart';

/// Photo → working → review (apps/mp's stocktake-flow): the stock-take agent
/// (polled, with its step trace) or the quick scan, on one photo. Per
/// business: `sl<ShelfScanCubit>(param1: businessId)`.
class ShelfScanCubit extends Cubit<ShelfScanState> {
  ShelfScanCubit({
    required this.businessId,
    required QuickScan quickScan,
    required StartStocktake startStocktake,
    required GetStocktake getStocktake,
    this.pollEvery = const Duration(milliseconds: 1500),
    this.giveUpAfter = const Duration(minutes: 6),
  }) : _quickScan = quickScan,
       _startStocktake = startStocktake,
       _getStocktake = getStocktake,
       super(const ScanPicking());

  final String businessId;
  final QuickScan _quickScan;
  final StartStocktake _startStocktake;
  final GetStocktake _getStocktake;
  final Duration pollEvery;

  /// The agent's budget is 150 s after a ~20–30 s first pass; stop polling well after that.
  final Duration giveUpAfter;

  /// Bumped by [cancel] and [retake]: a reply for an older run is dropped.
  int _gen = 0;

  void usePhoto(ShelfPhoto photo) => emit(ScanPicking(photo: photo));

  /// Back to the camera, no photo.
  void retake() {
    _gen++;
    emit(const ScanPicking());
  }

  /// Stop waiting; the photo stays for another try.
  void cancel() {
    _gen++;
    emit(ScanPicking(photo: state.photo));
  }

  Future<void> quickScan() async {
    final photo = state.photo;
    if (photo == null) return;
    final gen = ++_gen;
    emit(ScanWorking(photo: photo, agent: false, startedAt: DateTime.now()));
    final result = await _quickScan(ScanPhotoParams(businessId: businessId, photo: photo));
    if (gen != _gen) return;
    emit(
      result.fold(
        (f) => ScanPicking(photo: photo, error: f.message),
        (scan) => ScanReady(photo: photo, scan: scan, fallback: false),
      ),
    );
  }

  Future<void> stocktake() async {
    final photo = state.photo;
    if (photo == null) return;
    final gen = ++_gen;
    final startedAt = DateTime.now();
    emit(ScanWorking(photo: photo, agent: true, startedAt: startedAt));
    final started = await _startStocktake(ScanPhotoParams(businessId: businessId, photo: photo));
    if (gen != _gen) return;
    final runId = started.fold((f) {
      emit(ScanPicking(photo: photo, error: f.message));
      return null;
    }, (id) => id);
    if (runId == null) return;

    bool late() => DateTime.now().difference(startedAt) > giveUpAfter;
    while (true) {
      await Future<void>.delayed(pollEvery);
      if (gen != _gen) return;
      final polled = await _getStocktake(RunParams(businessId: businessId, runId: runId));
      if (gen != _gen) return;
      final next = polled.fold<ShelfScanState?>(
        // A blip while polling isn't fatal; the run keeps going on the server.
        (f) => late() ? ScanPicking(photo: photo, error: f.message) : null,
        (run) => switch (run) {
          StocktakeRun(status: StocktakeStatus.running) when late() => ScanPicking(
            photo: photo,
            error: 'The stock-take is taking much longer than usual. Try again, or use Quick scan.',
          ),
          StocktakeRun(status: StocktakeStatus.running) => ScanWorking(
            photo: photo,
            agent: true,
            startedAt: startedAt,
            steps: run.steps,
          ),
          StocktakeRun(status: StocktakeStatus.failed) || StocktakeRun(result: null) => ScanPicking(
            photo: photo,
            error: 'The stock-take failed${run.error == null ? '' : ': ${run.error}'}. Try again, or use Quick scan.',
          ),
          StocktakeRun(:final result?) => ScanReady(
            photo: photo,
            scan: result,
            fallback: run.status == StocktakeStatus.fallback,
          ),
        },
      );
      if (next == null) continue;
      emit(next);
      if (next is! ScanWorking) return;
    }
  }
}

sealed class ShelfScanState extends Equatable {
  const ShelfScanState();
  ShelfPhoto? get photo;
}

/// No photo yet, or one ready to scan; [error] from the last try.
class ScanPicking extends ShelfScanState {
  const ScanPicking({this.photo, this.error});
  @override
  final ShelfPhoto? photo;
  final String? error;

  @override
  List<Object?> get props => [photo, error];
}

class ScanWorking extends ShelfScanState {
  const ScanWorking({required this.photo, required this.agent, required this.startedAt, this.steps = const []});
  @override
  final ShelfPhoto photo;

  /// The stock-take agent (with a step trace), else the quick scan.
  final bool agent;
  final DateTime startedAt;
  final List<AgentStep> steps;

  @override
  List<Object?> get props => [photo, agent, startedAt, steps];
}

class ScanReady extends ShelfScanState {
  const ScanReady({required this.photo, required this.scan, required this.fallback});
  @override
  final ShelfPhoto photo;
  final ShelfScan scan;

  /// The agent couldn't finish; this is its first pass.
  final bool fallback;

  @override
  List<Object?> get props => [photo, scan, fallback];
}
