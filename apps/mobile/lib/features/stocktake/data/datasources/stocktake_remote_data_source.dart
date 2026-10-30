import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/photo_check.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/entities/stocktake_history.dart';
import '../models/shelf_scan_model.dart';

abstract class StocktakeRemoteDataSource {
  Future<ShelfScan> quickScan(String businessId, Uint8List image, String mimeType);
  Future<String> startStocktake(String businessId, Uint8List image, String mimeType);
  Future<StocktakeRun> getStocktake(String businessId, String runId);
  Future<ScanConfirmResult> confirm(String businessId, String scanId, List<Map<String, Object?>> decisions);
  Future<List<HistoryEntry>> history(String businessId, {int limit = 50});
  Future<ShelfScan> getScan(String businessId, String scanId);
  Future<ScanRerun> rerun(String businessId, String scanId);

  /// Returns when it was discarded.
  Future<DateTime?> discard(String businessId, String scanId);
  Future<PhotoCheck> checkPhoto(String businessId, Uint8List image, String mimeType);
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

  @override
  Future<List<HistoryEntry>> history(String businessId, {int limit = 50}) => _guard(() async {
    final res = await _dio.get<List<dynamic>>('${_vision(businessId)}/stocktakes', queryParameters: {'limit': limit});
    return historyFromJson(res.data ?? const []);
  });

  @override
  Future<ShelfScan> getScan(String businessId, String scanId) => _guard(() async {
    // Candidate details are fetched again from the catalogue: allow for it.
    final res = await _dio.get<Map<String, dynamic>>(
      '${_vision(businessId)}/shelf-scans/$scanId',
      options: Options(receiveTimeout: const Duration(seconds: 30)),
    );
    return shelfScanFromJson(res.data!);
  });

  @override
  Future<ScanRerun> rerun(String businessId, String scanId) => _guard(() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${_vision(businessId)}/shelf-scans/$scanId/rerun',
      options: Options(receiveTimeout: const Duration(seconds: 30)),
    );
    final j = res.data!;
    return ScanRerun(runId: j['runId'] as String? ?? '', rerunOf: j['rerunOf'] as String? ?? scanId);
  });

  @override
  Future<DateTime?> discard(String businessId, String scanId) => _guard(() async {
    final res = await _dio.post<Map<String, dynamic>>('${_vision(businessId)}/shelf-scans/$scanId/discard');
    final at = res.data?['discardedAt'];
    return at is String ? DateTime.tryParse(at) : null;
  });

  @override
  Future<PhotoCheck> checkPhoto(String businessId, Uint8List image, String mimeType) => _guard(() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${_vision(businessId)}/photo-check',
      data: _form(image, mimeType),
      options: Options(sendTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 30)),
    );
    return photoCheckFromJson(res.data!);
  }, maxMb: 1);

  Future<T> _guard<T>(Future<T> Function() call, {int maxMb = 4}) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw visionException(e, maxMb: maxMb);
    }
  }
}

/// Vision-specific copy, as mp's stock-take actions; the API's own message for
/// other 4xx, 409 included (it's user-safe and says what to do instead).
ServerException visionException(DioException e, {int maxMb = 4}) {
  final base = toServerException(e);
  final status = base.statusCode;
  final timedOut = e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.sendTimeout;
  final message = switch (status) {
    _ when timedOut || status == 504 => 'Recognition timed out. Try again, or a photo with fewer products.',
    503 when RegExp('not configured', caseSensitive: false).hasMatch(base.message) =>
      "Photo recognition isn't set up on this server yet.",
    503 => 'Recognition is busy. Try again in a moment.',
    413 => 'That photo is too large ($maxMb MB max). Try a smaller one.',
    409 => base.message,
    null => base.message,
    < 500 => base.message,
    _ => 'Recognition failed on our side. Try again.',
  };
  return ServerException(message, statusCode: status);
}
