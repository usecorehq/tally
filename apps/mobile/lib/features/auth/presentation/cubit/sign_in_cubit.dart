import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/failures.dart';
import '../../domain/entities/merchant_user.dart';
import '../../domain/usecases/account_usecases.dart';
import '../../domain/usecases/sign_in.dart';

part 'sign_in_state.dart';

/// Form-local state for the sign-in page. On success the page tells
/// [AuthBloc] via AuthUserChanged.
class SignInCubit extends Cubit<SignInState> {
  SignInCubit(this._signIn, this._resendSignupCode) : super(const SignInState());

  final SignIn _signIn;
  final ResendSignupCode _resendSignupCode;

  Future<void> submit({required String email, required String password}) async {
    emit(state.copyWith(status: SignInStatus.submitting, clearError: true));
    final result = await _signIn(SignInParams(email: email, password: password));
    final failure = result.fold((f) => f, (_) => null);
    if (failure is EmailNotConfirmedFailure) {
      // Same as Qorelly: send a fresh code and confirm before signing in.
      await _resendSignupCode(email);
      emit(state.copyWith(status: SignInStatus.unconfirmed, error: failure.message));
      return;
    }
    emit(
      result.fold(
        (failure) => state.copyWith(status: SignInStatus.failure, error: failure.message),
        (user) => state.copyWith(status: SignInStatus.success, user: user),
      ),
    );
  }
}
