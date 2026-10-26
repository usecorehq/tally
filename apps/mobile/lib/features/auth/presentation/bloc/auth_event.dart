part of 'auth_bloc.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthStarted extends AuthEvent {
  const AuthStarted();
}

class AuthUserChanged extends AuthEvent {
  const AuthUserChanged(this.user);
  final MerchantUser? user;

  @override
  List<Object?> get props => [user];
}

class AuthSignOutRequested extends AuthEvent {
  const AuthSignOutRequested();
}
