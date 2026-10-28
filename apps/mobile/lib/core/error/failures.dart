import 'package:equatable/equatable.dart';

/// What the domain and presentation layers see — never a raw exception.
sealed class Failure extends Equatable {
  const Failure(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class ServerFailure extends Failure {
  const ServerFailure(super.message);
}

class AuthFailure extends Failure {
  const AuthFailure(super.message);
}

/// The API answered 404: the thing asked for doesn't exist (e.g. an unknown barcode).
class NotFoundFailure extends Failure {
  const NotFoundFailure(super.message);
}

/// The API answered 409: the change conflicts with existing data (e.g. a barcode already linked).
class ConflictFailure extends Failure {
  const ConflictFailure(super.message);
}
