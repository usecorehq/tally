import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/inventory_item.dart';

abstract class InventoryRepository {
  Future<Either<Failure, List<InventoryItem>>> getInventory(String businessId);

  /// [NotFoundFailure] when no active item has this barcode.
  Future<Either<Failure, InventoryItem>> findByBarcode(String businessId, String barcode);

  /// [ConflictFailure] when another item already has this barcode.
  Future<Either<Failure, InventoryItem>> linkBarcode(String businessId, String itemId, String barcode);
}
