import 'package:dio/dio.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/catalogue_product.dart';
import '../models/catalogue_model.dart';

abstract class CatalogueRemoteDataSource {
  Future<List<CatalogueProduct>> search(String q, {int limit = 10});

  /// Follows a merged product once.
  Future<CatalogueProductDetail> product(String qid);
}

class CatalogueRemoteDataSourceImpl implements CatalogueRemoteDataSource {
  const CatalogueRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<CatalogueProduct>> search(String q, {int limit = 10}) => _guard(() async {
    final res = await _dio.get<Map<String, dynamic>>('/catalog/products', queryParameters: {'q': q, 'limit': limit});
    return catalogueSearchFromJson(res.data ?? const {});
  });

  @override
  Future<CatalogueProductDetail> product(String qid) => _guard(() async {
    var json = await _get(qid);
    // Every product has a status; only a merged one has mergedInto.
    if (mergedInto(json) case final next?) json = await _get(next);
    return catalogueProductFromJson(json);
  });

  Future<Map<String, dynamic>> _get(String qid) async {
    final res = await _dio.get<Map<String, dynamic>>('/catalog/products/${Uri.encodeComponent(qid)}');
    return res.data ?? const {};
  }

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      final base = toServerException(e);
      // The API answers 503 when Qore Catalog is down or slow.
      if (base.statusCode == 503) {
        throw const ServerException('The catalogue is busy. Try again in a moment.', statusCode: 503);
      }
      throw base;
    }
  }
}
