import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/business.dart';
import '../../domain/entities/business_vertical.dart';
import '../../domain/usecases/setup_usecases.dart';

/// Onboarding step 1 (apps/mp's business step): name, industry, sub-type.
class SetupBusinessCubit extends Cubit<SetupBusinessState> {
  SetupBusinessCubit({required GetBusinessVerticals getVerticals, required CreateBusiness createBusiness})
    : _getVerticals = getVerticals,
      _createBusiness = createBusiness,
      super(const SetupBusinessState());

  final GetBusinessVerticals _getVerticals;
  final CreateBusiness _createBusiness;

  Future<void> load() async {
    emit(state.copyWith(verticalsStatus: VerticalsStatus.loading));
    final result = await _getVerticals(const NoParams());
    emit(
      result.fold(
        (f) => state.copyWith(verticalsStatus: VerticalsStatus.error, verticalsError: f.message),
        (list) => state.copyWith(verticalsStatus: VerticalsStatus.ready, verticals: list),
      ),
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

  Future<void> submit(String name) async {
    emit(state.copyWith(submitting: true, clearError: true));
    final result = await _createBusiness(CreateBusinessParams(name: name, subtypeCode: state.subtypeCode));
    emit(
      result.fold(
        (f) => state.copyWith(submitting: false, error: f.message),
        (business) => state.copyWith(submitting: false, created: business),
      ),
    );
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
    this.submitting = false,
    this.error,
    this.created,
  });

  final VerticalsStatus verticalsStatus;
  final List<BusinessVertical> verticals;
  final String? verticalsError;
  final String verticalCode;
  final String subtypeCode;
  final bool submitting;

  /// The create failed (shown above the form).
  final String? error;

  /// Set once the business exists; the page moves on.
  final Business? created;

  BusinessVertical? get vertical => verticals.where((v) => v.code == verticalCode).firstOrNull;

  SetupBusinessState copyWith({
    VerticalsStatus? verticalsStatus,
    List<BusinessVertical>? verticals,
    String? verticalsError,
    String? verticalCode,
    String? subtypeCode,
    bool? submitting,
    String? error,
    bool clearError = false,
    Business? created,
  }) => SetupBusinessState(
    verticalsStatus: verticalsStatus ?? this.verticalsStatus,
    verticals: verticals ?? this.verticals,
    verticalsError: verticalsError ?? this.verticalsError,
    verticalCode: verticalCode ?? this.verticalCode,
    subtypeCode: subtypeCode ?? this.subtypeCode,
    submitting: submitting ?? this.submitting,
    error: clearError ? null : (error ?? this.error),
    created: created ?? this.created,
  );

  @override
  List<Object?> get props => [
    verticalsStatus,
    verticals,
    verticalsError,
    verticalCode,
    subtypeCode,
    submitting,
    error,
    created,
  ];
}
