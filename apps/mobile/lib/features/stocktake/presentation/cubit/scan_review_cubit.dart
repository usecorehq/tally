import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/catalogue_product.dart';
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

  /// A product found outside the line's suggestions (search, another size): its name, and its typical
  /// price when it has one (else the merchant's own stays), as mp's picker.
  void chooseCatalogueProduct(String id, CatalogueProductDetail p) {
    final c = state.choices[id]!;
    emit(
      state.copyWith(
        choices: {
          ...state.choices,
          id: c.copyWith(choice: p.qid, name: p.name, price: p.priceMedian?.toString()),
        },
        picks: {...state.picks, id: p.toCandidate()},
      ),
    );
  }

  void setName(String id, String name) => _update(id, (c) => c.copyWith(name: name));

  void setPrice(String id, String price) => _update(id, (c) => c.copyWith(price: price));

  void select(String? id) => emit(state.copyWith(selected: id, clearSelected: id == null));

  /// The list, or one line at a time.
  void setMode(ReviewMode mode) => emit(state.copyWith(mode: mode));

  /// One by one: is the current line ready to accept? Flags it when not (the card shows what's missing and
  /// stays). An earlier skip goes back to the line's starting action, which may still need choosing.
  bool canAcceptCurrent() {
    final d = state.current;
    if (d == null) return false;
    final c = _accepted(d);
    if (ScanProblems.of(c).any) {
      emit(state.copyWith(choices: {...state.choices, d.id: c}, flagged: {...state.flagged, d.id}));
      return false;
    }
    return true;
  }

  /// One by one: keep the current line as set and move on.
  void acceptCurrent() {
    final d = state.current;
    if (d == null || !canAcceptCurrent()) return;
    emit(
      state.copyWith(
        choices: {...state.choices, d.id: _accepted(d)},
        flagged: {...state.flagged}..remove(d.id),
        cursor: state.cursor + 1,
      ),
    );
  }

  /// One by one: skip the current line and move on.
  void skipCurrent() {
    final d = state.current;
    if (d == null) return;
    emit(
      state.copyWith(
        choices: {...state.choices, d.id: state.choices[d.id]!.withAction(ScanAction.skip)},
        flagged: {...state.flagged}..remove(d.id),
        cursor: state.cursor + 1,
      ),
    );
  }

  /// One by one: back a card (its decision stays until changed).
  void previous() => emit(state.copyWith(cursor: (state.cursor - 1).clamp(0, state.rows.length)));

  /// One by one: open a given line (from the summary).
  void goTo(String id) {
    final i = state.rows.indexWhere((d) => d.id == id);
    if (i >= 0) emit(state.copyWith(cursor: i, mode: ReviewMode.cards));
  }

  ScanChoice _accepted(ScanDetection d) {
    final c = state.choices[d.id]!;
    return c.action == ScanAction.skip ? c.withAction(initialAction(d)) : c;
  }

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

/// One by one opens first after a scan; the list is one tap away.
enum ReviewMode { cards, list }

class ScanReviewState extends Equatable {
  const ScanReviewState({
    this.mode = ReviewMode.cards,
    this.cursor = 0,
    this.flagged = const {},
    required this.scan,
    required this.rows,
    required this.choices,
    this.decidedEarlier = 0,
    this.selected,
    this.attempted = false,
    this.submitting = false,
    this.error,
    this.result,
    this.picks = const {},
  });

  factory ScanReviewState.of(ShelfScan scan) {
    final rows = reviewOrder(scan.detections);
    return ScanReviewState(
      scan: scan,
      rows: rows,
      choices: {for (final d in rows) d.id: ScanChoice.initial(d)},
      decidedEarlier: countDecidedEarlier(scan.detections),
    );
  }

  final ShelfScan scan;

  final ReviewMode mode;

  /// One by one: the line on screen; rows.length = all done (the summary).
  final int cursor;

  /// One by one: lines accepted with something missing (shown on their card).
  final Set<String> flagged;

  ScanDetection? get current => cursor < rows.length ? rows[cursor] : null;

  /// Undecided lines in review order (agent-flagged first).
  final List<ScanDetection> rows;
  final Map<String, ScanChoice> choices;

  /// Lines confirmed earlier, not shown again.
  final int decidedEarlier;

  /// The line highlighted on the photo.
  final String? selected;
  final bool attempted;
  final bool submitting;
  final String? error;

  /// Set once confirmed: the page shows the outcome.
  final ScanConfirmResult? result;

  /// Per line, a product picked from the catalogue outside its suggestions.
  final Map<String, ScanCandidate> picks;

  /// The line's picked product: one of its suggestions, or one picked from the catalogue.
  ScanCandidate? pickedProduct(ScanDetection d) {
    final c = choices[d.id];
    if (c == null) return null;
    return pickedCandidate(d, c) ?? (picks[d.id]?.qid == c.choice ? picks[d.id] : null);
  }

  List<String> get invalidIds => [
    for (final d in rows)
      if (ScanProblems.of(choices[d.id]!).any) d.id,
  ];

  /// Lines per action, for the footer.
  Map<ScanAction, int> get counts => {
    for (final a in ScanAction.values) a: rows.where((d) => choices[d.id]!.action == a).length,
  };

  /// Lines with no action yet ("N to choose").
  int get toChoose => rows.where((d) => choices[d.id]!.action == null).length;

  /// Units going into stock (skips and undecided lines excluded).
  int get units => rows.fold(0, (sum, d) {
    final c = choices[d.id]!;
    return c.action == null || c.action == ScanAction.skip ? sum : sum + (int.tryParse(c.quantity.trim()) ?? 0);
  });

  ScanReviewState copyWith({
    ReviewMode? mode,
    int? cursor,
    Set<String>? flagged,
    Map<String, ScanChoice>? choices,
    String? selected,
    bool clearSelected = false,
    bool? attempted,
    bool? submitting,
    String? error,
    bool clearError = false,
    ScanConfirmResult? result,
    Map<String, ScanCandidate>? picks,
  }) => ScanReviewState(
    mode: mode ?? this.mode,
    cursor: cursor ?? this.cursor,
    flagged: flagged ?? this.flagged,
    scan: scan,
    rows: rows,
    choices: choices ?? this.choices,
    decidedEarlier: decidedEarlier,
    selected: clearSelected ? null : (selected ?? this.selected),
    attempted: attempted ?? this.attempted,
    submitting: submitting ?? this.submitting,
    error: clearError ? null : (error ?? this.error),
    result: result ?? this.result,
    picks: picks ?? this.picks,
  );

  @override
  List<Object?> get props => [
    scan,
    rows,
    choices,
    decidedEarlier,
    mode,
    cursor,
    flagged,
    selected,
    attempted,
    submitting,
    error,
    result,
    picks,
  ];
}
