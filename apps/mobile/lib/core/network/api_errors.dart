import 'package:dio/dio.dart';

import '../error/exceptions.dart';
import '../error/failures.dart';

/// Turn a Dio error into a [ServerException] carrying apps/api's status and its
/// (user-safe) `message`.
ServerException toServerException(DioException e) {
  final status = e.response?.statusCode;
  final data = e.response?.data;
  final message = switch (data) {
    {'message': final String m} => m,
    {'message': final List<dynamic> m} => m.join('; '),
    _ => status == null ? 'Check your connection and try again.' : 'Something went wrong. Try again.',
  };
  return ServerException(message, statusCode: status);
}

/// The [Failure] for a [ServerException], by status.
Failure toFailure(ServerException e) => switch (e.statusCode) {
  404 => NotFoundFailure(e.message),
  409 => ConflictFailure(e.message),
  _ => ServerFailure(e.message),
};
