import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/shelf_scan.dart';
import '../../domain/scan_review.dart';
import '../../domain/usecases/stocktake_usecases.dart';

/// Review one scan: fix counts, matches and prices, then confirm into stock.
/// Nothing is stocked until [submit]. Per scan:
/// `sl<ScanReviewCubit>(param1: businessId, param2: scan)`.
class ScanReviewCubit extends Cubit<ScanReviewState> {
  ScanReviewCubit({required this.businessId, required ShelfScan scan, required ConfirmScan confirm})
    : _confirm = confirm,
      super(ScanReviewState.of(scan));

  final String businessId;
  final ConfirmScan _confirm;

  /// Changing the action keeps the count, name and price typed so far.
  void setAction(String id, ScanAction action) => _update(id, (c) => c.copyWith(action: action));

  void setQuantity(String id, String quantity) => _update(id, (c) => c.copyWith(quantity: quantity));

  void choose(String id, String choice) => _update(id, (c) => chooseProduct(_row(id), c, choice));

  void setName(String id, String name) => _update(id, (c) => c.copyWith(name: name));

  void setPrice(String id, String price) => _update(id, (c) => c.copyWith(price: price));

  void select(String? id) => emit(state.copyWith(selected: id, clearSelected: id == null));

  /// Qorelly rule: Confirm stays enabled; pressing it flags what's missing.
  Future<void> submit() async {
    if (state.invalidIds.isNotEmpty) {
      emit(state.copyWith(attempted: true));
      return;
    }
    emit(state.copyWith(attempted: true, submitting: true, clearError: true));
    final result = await _confirm(
      ConfirmScanParams(
        businessId: businessId,
        scanId: state.scan.scanId,
        detections: state.rows,
        choices: state.choices,
      ),
    );
    emit(
      result.fold(
        (f) => state.copyWith(submitting: false, error: f.message),
        (r) => state.copyWith(submitting: false, result: r),
      ),
    );
  }

  ScanDetection _row(String id) => state.rows.firstWhere((d) => d.id == id);

  void _update(String id, ScanChoice Function(ScanChoice) change) =>
      emit(state.copyWith(choices: {...state.choices, id: change(state.choices[id]!)}));
}

class ScanReviewState extends Equatable {
  const ScanReviewState({
    required this.scan,
    required this.rows,
    required this.choices,
    this.selected,
    this.attempted = false,
    this.submitting = false,
    this.error,
    this.result,
  });

  factory ScanReviewState.of(ShelfScan scan) {
    final rows = reviewOrder(scan.detections);
    return ScanReviewState(scan: scan, rows: rows, choices: {for (final d in rows) d.id: ScanChoice.initial(d)});
  }

  final ShelfScan scan;

  /// Lines in review order (agent-flagged first).
  final List<ScanDetection> rows;
  final Map<String, ScanChoice> choices;

  /// The line highlighted on the photo.
  final String? selected;
  final bool attempted;
  final bool submitting;
  final String? error;

  /// Set once confirmed: the page shows the outcome.
  final ScanConfirmResult? result;

  List<String> get invalidIds => [
    for (final d in rows)
      if (ScanProblems.of(choices[d.id]!).any) d.id,
  ];

  /// Lines per action, for the footer.
  Map<ScanAction, int> get counts => {
    for (final a in ScanAction.values) a: rows.where((d) => choices[d.id]!.action == a).length,
  };

  /// Units going into stock (skips excluded).
  int get units => rows.fold(0, (sum, d) {
    final c = choices[d.id]!;
    return c.action == ScanAction.skip ? sum : sum + (int.tryParse(c.quantity.trim()) ?? 0);
  });

  ScanReviewState copyWith({
    Map<String, ScanChoice>? choices,
    String? selected,
    bool clearSelected = false,
    bool? attempted,
    bool? submitting,
    String? error,
    bool clearError = false,
    ScanConfirmResult? result,
  }) => ScanReviewState(
    scan: scan,
    rows: rows,
    choices: choices ?? this.choices,
    selected: clearSelected ? null : (selected ?? this.selected),
    attempted: attempted ?? this.attempted,
    submitting: submitting ?? this.submitting,
    error: clearError ? null : (error ?? this.error),
    result: result ?? this.result,
  );

  @override
  List<Object?> get props => [scan, rows, choices, selected, attempted, submitting, error, result];
}
