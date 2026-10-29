import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/business.dart';
import '../../domain/entities/business_draft.dart';
import '../../domain/entities/starter_items.dart';
import '../../domain/usecases/setup_usecases.dart';

/// Onboarding step 2: keep / swap / remove the sub-type's template items, set
/// prices and opening stock, confirm, apply. Finish (or Skip) creates the
/// business from step 1's draft first, once — a retry reuses it. Per draft:
/// `sl<StarterItemsCubit>(param1: draft)`.
class StarterItemsCubit extends Cubit<StarterItemsState> {
  StarterItemsCubit({
    required BusinessDraft draft,
    required GetStarterRows getRows,
    required CreateBusiness createBusiness,
    required SubmitStarterItems submit,
  }) : _getRows = getRows,
       _createBusiness = createBusiness,
       _submit = submit,
       super(StarterItemsState(draft: draft));

  final GetStarterRows _getRows;
  final CreateBusiness _createBusiness;
  final SubmitStarterItems _submit;

  Future<void> load() async {
    emit(state.copyWith(loadStatus: StarterLoadStatus.loading));
    final result = await _getRows(state.draft.subtypeCode);
    emit(
      result.fold(
        (f) => state.copyWith(loadStatus: StarterLoadStatus.error, error: f.message),
        (rows) => state.copyWith(
          loadStatus: StarterLoadStatus.ready,
          rows: rows,
          choices: {for (final r in rows) r.key: StarterChoice.initial(r)},
          clearError: true,
        ),
      ),
    );
  }

  void setKeep(String key, bool keep) => _update(key, (c) => c.copyWith(keep: keep));

  /// Picking a catalogue product resets the price to its typical price, if it has one (as mp).
  void choose(String key, String choice) {
    final row = state.rows.firstWhere((r) => r.key == key);
    final next = row.candidates.where((c) => c.qid == choice).firstOrNull;
    _update(key, (c) => c.copyWith(choice: choice, price: next?.priceMedian?.toString()));
  }

  void setOwnName(String key, String name) => _update(key, (c) => c.copyWith(ownName: name));

  void setPrice(String key, String price) => _update(key, (c) => c.copyWith(price: price));

  void setOpening(String key, String opening) => _update(key, (c) => c.copyWith(opening: opening));

  /// Qorelly rule: Continue stays enabled; pressing it flags what's missing.
  void next() {
    if (state.invalidKeys.isNotEmpty) {
      emit(state.copyWith(attempted: true));
      return;
    }
    emit(state.copyWith(step: StarterStep.confirm, attempted: true, clearError: true));
  }

  void back() => emit(state.copyWith(step: StarterStep.pick, clearError: true));

  /// Back to step 1 kept the same type but a new name. Picks are kept.
  void rename(BusinessDraft draft) => emit(state.copyWith(draft: draft));

  Future<void> finish() async {
    emit(state.copyWith(submitting: true, clearError: true));
    final business = await _ensureBusiness();
    if (business == null) return;
    final result = await _submit(
      SubmitStarterParams(businessId: business.id, rows: state.rows, choices: state.choices),
    );
    emit(
      result.fold(
        (f) => state.copyWith(submitting: false, error: f.message),
        (r) => state.copyWith(submitting: false, step: StarterStep.done, result: r),
      ),
    );
  }

  /// No starter items: just the business. True once it exists.
  Future<bool> skip() async {
    emit(state.copyWith(submitting: true, clearError: true));
    final business = await _ensureBusiness();
    if (business == null) return false;
    emit(state.copyWith(submitting: false));
    return true;
  }

  Future<Business?> _ensureBusiness() async {
    if (state.business case final b?) return b;
    final result = await _createBusiness(state.draft);
    return result.fold(
      (f) {
        emit(state.copyWith(submitting: false, error: f.message));
        return null;
      },
      (b) {
        emit(state.copyWith(business: b));
        return b;
      },
    );
  }

  void _update(String key, StarterChoice Function(StarterChoice) change) =>
      emit(state.copyWith(choices: {...state.choices, key: change(state.choices[key]!)}));
}

enum StarterLoadStatus { loading, error, ready }

enum StarterStep { pick, confirm, done }

class StarterItemsState extends Equatable {
  const StarterItemsState({
    required this.draft,
    this.business,
    this.loadStatus = StarterLoadStatus.loading,
    this.rows = const [],
    this.choices = const {},
    this.step = StarterStep.pick,
    this.attempted = false,
    this.submitting = false,
    this.error,
    this.result,
  });

  final BusinessDraft draft;

  /// Created on Finish or Skip; until then, step 1 can still change.
  final Business? business;

  final StarterLoadStatus loadStatus;
  final List<StarterRow> rows;
  final Map<String, StarterChoice> choices;
  final StarterStep step;
  final bool attempted;
  final bool submitting;
  final String? error;
  final StarterResult? result;

  List<StarterRow> get kept => [
    for (final r in rows)
      if (choices[r.key]!.keep) r,
  ];

  List<String> get invalidKeys => [
    for (final r in rows)
      if (StarterProblems.of(choices[r.key]!).any) r.key,
  ];

  /// Rows by template group, in template order.
  List<(String, List<StarterRow>)> get groups {
    final map = <String, List<StarterRow>>{};
    for (final r in rows) {
      (map[r.groupLabel] ??= []).add(r);
    }
    return [for (final e in map.entries) (e.key, e.value)];
  }

  StarterItemsState copyWith({
    BusinessDraft? draft,
    Business? business,
    StarterLoadStatus? loadStatus,
    List<StarterRow>? rows,
    Map<String, StarterChoice>? choices,
    StarterStep? step,
    bool? attempted,
    bool? submitting,
    String? error,
    bool clearError = false,
    StarterResult? result,
  }) => StarterItemsState(
    draft: draft ?? this.draft,
    business: business ?? this.business,
    loadStatus: loadStatus ?? this.loadStatus,
    rows: rows ?? this.rows,
    choices: choices ?? this.choices,
    step: step ?? this.step,
    attempted: attempted ?? this.attempted,
    submitting: submitting ?? this.submitting,
    error: clearError ? null : (error ?? this.error),
    result: result ?? this.result,
  );

  @override
  List<Object?> get props => [draft, business, loadStatus, rows, choices, step, attempted, submitting, error, result];
}
