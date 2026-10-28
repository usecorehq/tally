import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/business_draft.dart';
import '../../domain/entities/business_vertical.dart';
import '../../domain/usecases/setup_usecases.dart';

/// Onboarding step 1 (apps/mp's business step): name, industry, sub-type.
/// Continue hands on a [BusinessDraft]; step 2 creates the business.
class SetupBusinessCubit extends Cubit<SetupBusinessState> {
  SetupBusinessCubit({required GetBusinessVerticals getVerticals})
    : _getVerticals = getVerticals,
      super(const SetupBusinessState());

  final GetBusinessVerticals _getVerticals;

  /// [subtypeCode]: the type picked before going back, shown picked.
  Future<void> load({String? subtypeCode}) async {
    emit(state.copyWith(verticalsStatus: VerticalsStatus.loading));
    final result = await _getVerticals(const NoParams());
    emit(
      result.fold((f) => state.copyWith(verticalsStatus: VerticalsStatus.error, verticalsError: f.message), (list) {
        final vertical = list.where((v) => v.subtypes.any((s) => s.code == subtypeCode)).firstOrNull;
        return state.copyWith(
          verticalsStatus: VerticalsStatus.ready,
          verticals: list,
          verticalCode: vertical?.code,
          subtypeCode: vertical == null ? null : subtypeCode,
        );
      }),
    );
  }

  /// A one-sub-type industry picks its sub-type too (as mp).
  void pickVertical(String code) {
    final vertical = state.verticals.firstWhere((v) => v.code == code);
    emit(
      state.copyWith(
        verticalCode: code,
        subtypeCode: vertical.subtypes.length == 1 ? vertical.subtypes.single.code : '',
        clearError: true,
      ),
    );
  }

  void pickSubtype(String code) => emit(state.copyWith(subtypeCode: code, clearError: true));

  void submit(String name) {
    final draft = BusinessDraft(name: name.trim(), subtypeCode: state.subtypeCode);
    final problem = businessDraftProblem(draft);
    emit(problem == null ? state.copyWith(draft: draft, clearError: true) : state.copyWith(error: problem));
  }
}

enum VerticalsStatus { loading, error, ready }

class SetupBusinessState extends Equatable {
  const SetupBusinessState({
    this.verticalsStatus = VerticalsStatus.loading,
    this.verticals = const [],
    this.verticalsError,
    this.verticalCode = '',
    this.subtypeCode = '',
    this.error,
    this.draft,
  });

  final VerticalsStatus verticalsStatus;
  final List<BusinessVertical> verticals;
  final String? verticalsError;
  final String verticalCode;
  final String subtypeCode;

  /// The answers don't pass the API's checks (shown above the form).
  final String? error;

  /// Set on a valid Continue; the page moves on.
  final BusinessDraft? draft;

  BusinessVertical? get vertical => verticals.where((v) => v.code == verticalCode).firstOrNull;

  SetupBusinessState copyWith({
    VerticalsStatus? verticalsStatus,
    List<BusinessVertical>? verticals,
    String? verticalsError,
    String? verticalCode,
    String? subtypeCode,
    String? error,
    bool clearError = false,
    BusinessDraft? draft,
  }) => SetupBusinessState(
    verticalsStatus: verticalsStatus ?? this.verticalsStatus,
    verticals: verticals ?? this.verticals,
    verticalsError: verticalsError ?? this.verticalsError,
    verticalCode: verticalCode ?? this.verticalCode,
    subtypeCode: subtypeCode ?? this.subtypeCode,
    error: clearError ? null : (error ?? this.error),
    draft: draft ?? this.draft,
  );

  @override
  List<Object?> get props => [verticalsStatus, verticals, verticalsError, verticalCode, subtypeCode, error, draft];
}
