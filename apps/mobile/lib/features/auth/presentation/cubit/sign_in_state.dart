part of 'sign_in_cubit.dart';

/// [unconfirmed]: right password, email never confirmed — a code was sent;
/// the page opens the code screen.
enum SignInStatus { initial, submitting, success, failure, unconfirmed }

class SignInState extends Equatable {
  const SignInState({this.status = SignInStatus.initial, this.user, this.error});

  final SignInStatus status;
  final MerchantUser? user;
  final String? error;

  SignInState copyWith({SignInStatus? status, MerchantUser? user, String? error, bool clearError = false}) =>
      SignInState(
        status: status ?? this.status,
        user: user ?? this.user,
        error: clearError ? null : (error ?? this.error),
      );

  @override
  List<Object?> get props => [status, user, error];
}
