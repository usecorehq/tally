import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/core/error/exceptions.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/core/network/api_errors.dart';

DioException _dio(int? status, [Object? data]) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    response: status == null ? null : Response(requestOptions: req, statusCode: status, data: data),
  );
}

void main() {
  test('carries the API status and message', () {
    final e = toServerException(_dio(409, {'message': 'Barcode 123 is already linked to another item'}));
    expect(e.statusCode, 409);
    expect(e.message, 'Barcode 123 is already linked to another item');
  });

  test('joins validation message lists', () {
    expect(
      toServerException(
        _dio(400, {
          'message': ['a', 'b'],
        }),
      ).message,
      'a; b',
    );
  });

  test('no response means a connection problem', () {
    expect(toServerException(_dio(null)).message, contains('connection'));
  });

  test('maps status to the right Failure', () {
    expect(toFailure(const ServerException('x', statusCode: 404)), isA<NotFoundFailure>());
    expect(toFailure(const ServerException('x', statusCode: 409)), isA<ConflictFailure>());
    expect(toFailure(const ServerException('x', statusCode: 500)), isA<ServerFailure>());
    expect(toFailure(const ServerException('x')), isA<ServerFailure>());
  });
}
