/// Thrown by data sources; repositories catch these and map them to [Failure]s.
class ServerException implements Exception {
  const ServerException(this.message, {this.statusCode});
  final String message;

  /// HTTP status from apps/api, when there was a response.
  final int? statusCode;
}

class AuthException implements Exception {
  const AuthException(this.message, {this.emailNotConfirmed = false});
  final String message;

  /// Right password, but the account's email was never confirmed.
  final bool emailNotConfirmed;
}
