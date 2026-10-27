import 'package:dartz/dartz.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/inventory_item.dart';
import '../../domain/repositories/inventory_repository.dart';
import '../datasources/inventory_remote_data_source.dart';

class InventoryRepositoryImpl implements InventoryRepository {
  const InventoryRepositoryImpl(this._remote);
  final InventoryRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<InventoryItem>>> getInventory(String businessId) =>
      _run(() => _remote.getInventory(businessId));

  @override
  Future<Either<Failure, InventoryItem>> findByBarcode(String businessId, String barcode) =>
      _run(() => _remote.findByBarcode(businessId, barcode));

  @override
  Future<Either<Failure, InventoryItem>> linkBarcode(String businessId, String itemId, String barcode) =>
      _run(() => _remote.linkBarcode(businessId, itemId, barcode));

  Future<Either<Failure, T>> _run<T>(Future<T> Function() call) async {
    try {
      return Right(await call());
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }
}
