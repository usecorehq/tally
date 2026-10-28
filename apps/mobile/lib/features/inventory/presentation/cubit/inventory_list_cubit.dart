import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/inventory_item.dart';
import '../../domain/usecases/inventory_usecases.dart';

part 'inventory_list_state.dart';

/// The Inventory tab: the business's stock, filtered by name on the device.
/// Per business: `sl<InventoryListCubit>(param1: businessId)`.
class InventoryListCubit extends Cubit<InventoryListState> {
  InventoryListCubit({required this.businessId, required GetInventory getInventory})
    : _getInventory = getInventory,
      super(const InventoryListLoading());

  final String businessId;
  final GetInventory _getInventory;
  String _query = '';

  Future<void> load() async {
    // A refresh keeps the list on screen; only the first load shows skeletons.
    if (state is! InventoryListLoaded) emit(const InventoryListLoading());
    final result = await _getInventory(businessId);
    emit(
      result.fold(
        (failure) => InventoryListError(failure.message),
        (items) => InventoryListLoaded(items: items, query: _query),
      ),
    );
  }

  void search(String query) {
    _query = query.trim();
    final s = state;
    if (s is InventoryListLoaded) emit(InventoryListLoaded(items: s.items, query: _query));
  }
}
