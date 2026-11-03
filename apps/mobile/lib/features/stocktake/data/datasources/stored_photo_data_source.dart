import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../../core/error/exceptions.dart';

/// Stored shelf photos and crops: presigned R2 links, fetched with a plain
/// Dio (no Bearer header, which R2 would reject).
abstract class StoredPhotoDataSource {
  Future<Uint8List> fetch(String url);
}

class StoredPhotoDataSourceImpl implements StoredPhotoDataSource {
  const StoredPhotoDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<Uint8List> fetch(String url) async {
    try {
      final res = await _dio.get<List<int>>(url, options: Options(responseType: ResponseType.bytes));
      return Uint8List.fromList(res.data ?? const []);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      throw ServerException(switch (status) {
        404 => "This photo wasn't kept.",
        // An expired presigned link answers 403.
        403 => 'This photo link expired. Open the stock-take again.',
        null => 'Check your connection and try again.',
        _ => "The photo couldn't be loaded.",
      }, statusCode: status);
    }
  }
}
