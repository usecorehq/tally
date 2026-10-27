import 'package:dio/dio.dart';

import '../../../../core/network/api_errors.dart';
import '../models/business_model.dart';

abstract class BusinessRemoteDataSource {
  Future<List<BusinessModel>> getMyBusinesses();
}

class BusinessRemoteDataSourceImpl implements BusinessRemoteDataSource {
  const BusinessRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<BusinessModel>> getMyBusinesses() async {
    try {
      final res = await _dio.get<List<dynamic>>('/businesses');
      return (res.data ?? []).map((e) => BusinessModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw toServerException(e);
    }
  }
}
