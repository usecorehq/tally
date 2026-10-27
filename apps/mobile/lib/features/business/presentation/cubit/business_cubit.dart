import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/business.dart';
import '../../domain/usecases/get_my_businesses.dart';

part 'business_state.dart';

/// Which business the app is working in. App-level, so the scanner and later
/// features share one selection.
class BusinessCubit extends Cubit<BusinessState> {
  BusinessCubit(this._getMyBusinesses) : super(const BusinessLoading());

  final GetMyBusinesses _getMyBusinesses;

  Future<void> load() async {
    emit(const BusinessLoading());
    final result = await _getMyBusinesses(const NoParams());
    emit(
      result.fold(
        (failure) => BusinessLoadError(failure.message),
        (list) => list.isEmpty ? const BusinessNone() : BusinessReady(businesses: list, selected: list.first),
      ),
    );
  }

  void select(Business business) {
    final s = state;
    if (s is BusinessReady) emit(BusinessReady(businesses: s.businesses, selected: business));
  }
}
