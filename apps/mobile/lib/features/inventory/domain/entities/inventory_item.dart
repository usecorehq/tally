import 'package:equatable/equatable.dart';

class InventoryItem extends Equatable {
  const InventoryItem({
    required this.id,
    required this.name,
    required this.price,
    required this.quantityOnHand,
    this.barcode,
    this.coreQid,
    this.reorderPoint,
  });

  final String id;
  final String name;

  /// Naira as the API sends it (`"2500.50"`): a string, never a double.
  final String price;
  final String quantityOnHand;
  final String? barcode;

  /// Linked Qore Catalog product, if any.
  final String? coreQid;

  /// Restock at or below this quantity; null when the merchant hasn't set one.
  final String? reorderPoint;

  /// On hand at or below [reorderPoint]. Quantities are compared as numbers
  /// only here — they are counts, never money.
  bool get isLowStock {
    final point = reorderPoint == null ? null : num.tryParse(reorderPoint!);
    final onHand = num.tryParse(quantityOnHand);
    return point != null && onHand != null && onHand <= point;
  }

  InventoryItem copyWith({String? barcode}) => InventoryItem(
    id: id,
    name: name,
    price: price,
    quantityOnHand: quantityOnHand,
    barcode: barcode ?? this.barcode,
    coreQid: coreQid,
    reorderPoint: reorderPoint,
  );

  @override
  List<Object?> get props => [id, name, price, quantityOnHand, barcode, coreQid, reorderPoint];
}
