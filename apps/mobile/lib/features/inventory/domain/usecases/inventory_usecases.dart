import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../barcode.dart';
import '../entities/inventory_item.dart';
import '../repositories/inventory_repository.dart';

class GetInventory implements UseCase<List<InventoryItem>, String> {
  const GetInventory(this._repository);
  final InventoryRepository _repository;

  @override
  Future<Either<Failure, List<InventoryItem>>> call(String businessId) => _repository.getInventory(businessId);
}

class FindByBarcode implements UseCase<InventoryItem, BarcodeParams> {
  const FindByBarcode(this._repository);
  final InventoryRepository _repository;

  @override
  Future<Either<Failure, InventoryItem>> call(BarcodeParams p) =>
      _repository.findByBarcode(p.businessId, normalizeBarcode(p.barcode));
}

class LinkBarcode implements UseCase<InventoryItem, LinkBarcodeParams> {
  const LinkBarcode(this._repository);
  final InventoryRepository _repository;

  @override
  Future<Either<Failure, InventoryItem>> call(LinkBarcodeParams p) =>
      _repository.linkBarcode(p.businessId, p.itemId, normalizeBarcode(p.barcode));
}

class BarcodeParams extends Equatable {
  const BarcodeParams({required this.businessId, required this.barcode});
  final String businessId;
  final String barcode;

  @override
  List<Object?> get props => [businessId, barcode];
}

class LinkBarcodeParams extends Equatable {
  const LinkBarcodeParams({required this.businessId, required this.itemId, required this.barcode});
  final String businessId;
  final String itemId;
  final String barcode;

  @override
  List<Object?> get props => [businessId, itemId, barcode];
}
