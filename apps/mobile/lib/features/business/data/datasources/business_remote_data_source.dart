import 'package:dio/dio.dart';

import '../../../../core/network/api_errors.dart';
import '../models/business_model.dart';
import '../../domain/entities/starter_items.dart';
import '../models/business_vertical_model.dart';
import '../models/starter_rows_model.dart';

abstract class BusinessRemoteDataSource {
  Future<List<BusinessModel>> getMyBusinesses();

  /// Qore Catalog business types, through apps/api (public route).
  Future<List<BusinessVerticalModel>> getVerticals();

  /// 422 when [subtypeCode] isn't a catalogue sub-type.
  Future<BusinessModel> createBusiness({required String name, required String subtypeCode});

  /// The sub-type's starter template with up to 2 catalogue suggestions per item.
  Future<List<StarterRow>> getStarterRows(String subtypeCode);

  /// Apply the starter list; safe to retry (rows are keyed by clientRef).
  Future<StarterResult> submitStarter(String businessId, List<Map<String, Object?>> items);
}

// First templates call per sub-type takes ~5 s (catalogue suggestions); a
// starter list writes up to 200 items — both outlast Dio's 20 s default.
const _slow = Duration(seconds: 60);

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

  @override
  Future<List<BusinessVerticalModel>> getVerticals() async {
    try {
      final res = await _dio.get<List<dynamic>>('/catalog/verticals');
      return (res.data ?? []).map((e) => BusinessVerticalModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw toServerException(e);
    }
  }

  @override
  Future<BusinessModel> createBusiness({required String name, required String subtypeCode}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/businesses',
        data: {'name': name, 'subtypeCode': subtypeCode},
      );
      return BusinessModel.fromJson(res.data!);
    } on DioException catch (e) {
      throw toServerException(e);
    }
  }

  @override
  Future<List<StarterRow>> getStarterRows(String subtypeCode) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/catalog/subtypes/${Uri.encodeComponent(subtypeCode)}/templates',
        queryParameters: {'suggestions': 2},
        options: Options(receiveTimeout: _slow),
      );
      return starterRowsFromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw toServerException(e);
    }
  }

  @override
  Future<StarterResult> submitStarter(String businessId, List<Map<String, Object?>> items) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/businesses/$businessId/inventory/starter',
        data: {'items': items},
        options: Options(receiveTimeout: _slow),
      );
      return starterResultFromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw toServerException(e);
    }
  }
}
