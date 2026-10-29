import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/shelf_scan.dart';
import '../models/shelf_scan_model.dart';

abstract class StocktakeRemoteDataSource {
  Future<ShelfScan> quickScan(String businessId, Uint8List image, String mimeType);
  Future<String> startStocktake(String businessId, Uint8List image, String mimeType);
  Future<StocktakeRun> getStocktake(String businessId, String runId);
  Future<ScanConfirmResult> confirm(String businessId, String scanId, List<Map<String, Object?>> decisions);
}

class StocktakeRemoteDataSourceImpl implements StocktakeRemoteDataSource {
  const StocktakeRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  String _vision(String businessId) => '/businesses/$businessId/vision';

  FormData _form(Uint8List image, String mimeType) => FormData.fromMap({
    'image': MultipartFile.fromBytes(
      image,
      filename: 'shelf.${mimeType.split('/').last}',
      contentType: DioMediaType.parse(mimeType),
    ),
  });

  @override
  Future<ShelfScan> quickScan(String businessId, Uint8List image, String mimeType) => _guard(() async {
    // The API gives up at 45 s; as mp, wait a little longer.
    final res = await _dio.post<Map<String, dynamic>>(
      '${_vision(businessId)}/shelf-scans',
      data: _form(image, mimeType),
      options: Options(sendTimeout: const Duration(seconds: 60), receiveTimeout: const Duration(seconds: 60)),
    );
    return shelfScanFromJson(res.data!);
  });

  @override
  Future<String> startStocktake(String businessId, Uint8List image, String mimeType) => _guard(() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${_vision(businessId)}/stocktakes',
      data: _form(image, mimeType),
      options: Options(sendTimeout: const Duration(seconds: 30), receiveTimeout: const Duration(seconds: 30)),
    );
    return res.data!['runId'] as String;
  });

  @override
  Future<StocktakeRun> getStocktake(String businessId, String runId) => _guard(() async {
    final res = await _dio.get<Map<String, dynamic>>('${_vision(businessId)}/stocktakes/$runId');
    return stocktakeRunFromJson(res.data!);
  });

  @override
  Future<ScanConfirmResult> confirm(String businessId, String scanId, List<Map<String, Object?>> decisions) =>
      _guard(() async {
        final res = await _dio.post<Map<String, dynamic>>(
          '${_vision(businessId)}/shelf-scans/$scanId/confirm',
          data: {'decisions': decisions},
          options: Options(receiveTimeout: const Duration(seconds: 60)),
        );
        return confirmResultFromJson(res.data!);
      });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw visionException(e);
    }
  }
}

/// Vision-specific copy, as mp's stock-take actions; the API's own message for
/// other 4xx (it's user-safe).
ServerException visionException(DioException e) {
  final base = toServerException(e);
  final status = base.statusCode;
  final timedOut = e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.sendTimeout;
  final message = switch (status) {
    _ when timedOut || status == 504 => 'Recognition timed out. Try again, or a photo with fewer products.',
    503 when RegExp('not configured', caseSensitive: false).hasMatch(base.message) =>
      "Photo recognition isn't set up on this server yet.",
    503 => 'Recognition is busy. Try again in a moment.',
    413 => 'That photo is too large (4 MB max). Try a smaller one.',
    null => base.message,
    < 500 => base.message,
    _ => 'Recognition failed on our side. Try again.',
  };
  return ServerException(message, statusCode: status);
}
