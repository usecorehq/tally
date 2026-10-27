import 'package:dio/dio.dart';

import '../../../../core/network/api_errors.dart';
import '../models/inventory_item_model.dart';

abstract class InventoryRemoteDataSource {
  Future<List<InventoryItemModel>> getInventory(String businessId);
  Future<InventoryItemModel> findByBarcode(String businessId, String barcode);
  Future<InventoryItemModel> linkBarcode(String businessId, String itemId, String barcode);
}

class InventoryRemoteDataSourceImpl implements InventoryRemoteDataSource {
  const InventoryRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<InventoryItemModel>> getInventory(String businessId) => _guard(() async {
    final res = await _dio.get<List<dynamic>>('/businesses/$businessId/inventory');
    return (res.data ?? []).map((e) => InventoryItemModel.fromJson(e as Map<String, dynamic>)).toList();
  });

  @override
  Future<InventoryItemModel> findByBarcode(String businessId, String barcode) => _guard(() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/businesses/$businessId/inventory/barcode/${Uri.encodeComponent(barcode)}',
    );
    return InventoryItemModel.fromJson(res.data!);
  });

  @override
  Future<InventoryItemModel> linkBarcode(String businessId, String itemId, String barcode) => _guard(() async {
    final res = await _dio.put<Map<String, dynamic>>(
      '/businesses/$businessId/inventory/$itemId/barcode',
      data: {'barcode': barcode},
    );
    return InventoryItemModel.fromJson(res.data!);
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw toServerException(e);
    }
  }
}
