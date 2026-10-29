import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/merchant_user.dart';
import '../../domain/usecases/account_usecases.dart';

// Screen-local state for sign up, the code screen, forgot password and the
// new password. Each page reacts to `done`: hand the user to AuthBloc, or
// move to the next screen.

enum AuthFormStatus { idle, submitting, done, failure }

class AuthFormState extends Equatable {
  const AuthFormState({this.status = AuthFormStatus.idle, this.user, this.error, this.notice});

  final AuthFormStatus status;

  /// Signed in by this step (null when the next step is a code).
  final MerchantUser? user;
  final String? error;

  /// A success line that doesn't end the step ("We sent a new code").
  final String? notice;

  bool get submitting => status == AuthFormStatus.submitting;

  @override
  List<Object?> get props => [status, user, error, notice];
}

class SignUpCubit extends Cubit<AuthFormState> {
  SignUpCubit(this._signUp) : super(const AuthFormState());
  final SignUp _signUp;

  Future<void> submit({
    required String fullName,
    required String email,
    required String phone,
    required String password,
  }) async {
    emit(const AuthFormState(status: AuthFormStatus.submitting));
    final result = await _signUp(SignUpParams(fullName: fullName, email: email, phone: phone, password: password));
    emit(
      result.fold(
        (f) => AuthFormState(status: AuthFormStatus.failure, error: f.message),
        (user) => AuthFormState(status: AuthFormStatus.done, user: user),
      ),
    );
  }
}

/// The emailed code, for a sign-up or a password reset ([recovery]).
class VerifyCodeCubit extends Cubit<AuthFormState> {
  VerifyCodeCubit({
    required this.email,
    required this.recovery,
    required VerifyEmailCode verify,
    required ResendSignupCode resendSignup,
    required RequestPasswordReset resendRecovery,
  }) : _verify = verify,
       _resendSignup = resendSignup,
       _resendRecovery = resendRecovery,
       super(const AuthFormState());

  final String email;
  final bool recovery;
  final VerifyEmailCode _verify;
  final ResendSignupCode _resendSignup;
  final RequestPasswordReset _resendRecovery;

  Future<void> verify(String code) async {
    emit(const AuthFormState(status: AuthFormStatus.submitting));
    final result = await _verify(VerifyCodeParams(email: email, code: code, recovery: recovery));
    emit(
      result.fold(
        (f) => AuthFormState(status: AuthFormStatus.failure, error: f.message),
        (user) => AuthFormState(status: AuthFormStatus.done, user: user),
      ),
    );
  }

  Future<void> resend() async {
    emit(const AuthFormState(status: AuthFormStatus.submitting));
    final result = recovery ? await _resendRecovery(email) : await _resendSignup(email);
    emit(
      result.fold(
        (f) => AuthFormState(status: AuthFormStatus.failure, error: f.message),
        (_) => AuthFormState(notice: 'We sent a new code to $email.'),
      ),
    );
  }
}

class ForgotPasswordCubit extends Cubit<AuthFormState> {
  ForgotPasswordCubit(this._request) : super(const AuthFormState());
  final RequestPasswordReset _request;

  Future<void> submit(String email) async {
    emit(const AuthFormState(status: AuthFormStatus.submitting));
    final result = await _request(email);
    emit(
      result.fold(
        (f) => AuthFormState(status: AuthFormStatus.failure, error: f.message),
        (_) => const AuthFormState(status: AuthFormStatus.done),
      ),
    );
  }
}

class NewPasswordCubit extends Cubit<AuthFormState> {
  NewPasswordCubit(this._setNewPassword) : super(const AuthFormState());
  final SetNewPassword _setNewPassword;

  Future<void> submit(String password) async {
    emit(const AuthFormState(status: AuthFormStatus.submitting));
    final result = await _setNewPassword(password);
    emit(
      result.fold(
        (f) => AuthFormState(status: AuthFormStatus.failure, error: f.message),
        (user) => AuthFormState(status: AuthFormStatus.done, user: user),
      ),
    );
  }
}
