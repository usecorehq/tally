import 'package:equatable/equatable.dart';

class InventoryItem extends Equatable {
  const InventoryItem({
    required this.id,
    required this.name,
    required this.price,
    required this.quantityOnHand,
    this.barcode,
    this.coreQid,
  });

  final String id;
  final String name;

  /// Naira as the API sends it (`"2500.50"`): a string, never a double.
  final String price;
  final String quantityOnHand;
  final String? barcode;

  /// Linked Qore Catalog product, if any.
  final String? coreQid;

  InventoryItem copyWith({String? barcode}) => InventoryItem(
    id: id,
    name: name,
    price: price,
    quantityOnHand: quantityOnHand,
    barcode: barcode ?? this.barcode,
    coreQid: coreQid,
  );

  @override
  List<Object?> get props => [id, name, price, quantityOnHand, barcode, coreQid];
}
