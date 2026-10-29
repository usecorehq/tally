part of 'inventory_list_cubit.dart';

sealed class InventoryListState extends Equatable {
  const InventoryListState();

  @override
  List<Object?> get props => [];
}

class InventoryListLoading extends InventoryListState {
  const InventoryListLoading();
}

/// The read failed — an error with retry, never an empty inventory or 0 counts.
class InventoryListError extends InventoryListState {
  const InventoryListError(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class InventoryListLoaded extends InventoryListState {
  const InventoryListLoaded({required this.items, this.query = ''});
  final List<InventoryItem> items;
  final String query;

  /// [items] whose name contains [query], ignoring case.
  List<InventoryItem> get visible {
    if (query.isEmpty) return items;
    final q = query.toLowerCase();
    return [for (final item in items) if (item.name.toLowerCase().contains(q)) item];
  }

  int get lowStockCount => items.where((i) => i.isLowStock).length;

  /// Units on hand across every item, as a quantity string (`"142.5"`).
  String get unitsOnHand {
    final total = items.fold<num>(0, (sum, i) => sum + (num.tryParse(i.quantityOnHand) ?? 0));
    return total == total.roundToDouble() ? total.toInt().toString() : total.toStringAsFixed(3);
  }

  @override
  List<Object?> get props => [items, query];
}
