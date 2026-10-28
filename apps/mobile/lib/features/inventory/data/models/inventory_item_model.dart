import '../../domain/entities/inventory_item.dart';

class InventoryItemModel extends InventoryItem {
  const InventoryItemModel({
    required super.id,
    required super.name,
    required super.price,
    required super.quantityOnHand,
    super.barcode,
    super.coreQid,
    super.reorderPoint,
  });

  factory InventoryItemModel.fromJson(Map<String, dynamic> json) => InventoryItemModel(
    id: json['id'] as String,
    name: json['name'] as String,
    price: json['price'] as String,
    quantityOnHand: json['quantityOnHand'] as String,
    barcode: json['barcode'] as String?,
    coreQid: json['coreQid'] as String?,
    reorderPoint: json['reorderPoint'] as String?,
  );
}
