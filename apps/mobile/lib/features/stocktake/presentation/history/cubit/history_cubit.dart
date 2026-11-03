import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/stocktake_history.dart';
import '../../../domain/usecases/stocktake_usecases.dart';
import '../history_text.dart';

sealed class HistoryState extends Equatable {
  const HistoryState();

  @override
  List<Object?> get props => [];
}

class HistoryLoading extends HistoryState {
  const HistoryLoading();
}

class HistoryFailed extends HistoryState {
  const HistoryFailed(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class HistoryLoaded extends HistoryState {
  const HistoryLoaded(this.entries);

  /// Newest activity first; reruns nested under their root.
  final List<HistoryEntry> entries;

  List<HistoryDay> get days => groupByDay(entries);
  bool get running => entries.any(isRunning);

  @override
  List<Object?> get props => [entries];
}

/// The Scans tab: one business's stock-takes and quick scans (apps/mp's /stocktake/history).
/// Re-reads every [pollEvery] while one is running and the tab is visible.
class HistoryCubit extends Cubit<HistoryState> {
  HistoryCubit({
    required this.businessId,
    required GetStocktakeHistory getHistory,
    required DiscardScan discardScan,
    this.pollEvery = const Duration(seconds: 5),
  }) : _getHistory = getHistory,
       _discard = discardScan,
       super(const HistoryLoading());

  final String businessId;
  final GetStocktakeHistory _getHistory;
  final DiscardScan _discard;
  final Duration pollEvery;

  Timer? _timer;
  bool _active = true;

  /// Bumped per read: an older reply is dropped.
  int _gen = 0;

  /// A failed first read shows the error; a failed re-read of a loaded list does too, as mp.
  Future<void> load() async {
    if (state is! HistoryLoaded) emit(const HistoryLoading());
    await _fetch(silent: false);
  }

  /// Polling and returning to the tab: a failure keeps the list on screen.
  Future<void> refresh() => _fetch(silent: state is HistoryLoaded);

  /// The tab was shown or hidden: polling only runs while it's shown.
  void setActive(bool active) {
    if (active == _active) return;
    _active = active;
    _timer?.cancel();
    if (active) refresh();
  }

  /// Null on success (the list is re-read), else the API's reason (409 once confirmed).
  Future<String?> discard(String scanId) async {
    final result = await _discard(ScanParams(businessId: businessId, scanId: scanId));
    if (isClosed) return null;
    return result.fold((f) => f.message, (_) {
      refresh();
      return null;
    });
  }

  Future<void> _fetch({required bool silent}) async {
    _timer?.cancel();
    final gen = ++_gen;
    final result = await _getHistory(HistoryParams(businessId: businessId));
    if (isClosed || gen != _gen) return;
    result.fold((f) {
      if (!silent || state is! HistoryLoaded) emit(HistoryFailed(f.message));
    }, (entries) => emit(HistoryLoaded(entries)));
    final s = state;
    if (_active && s is HistoryLoaded && s.running) _timer = Timer(pollEvery, refresh);
  }

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }
}
