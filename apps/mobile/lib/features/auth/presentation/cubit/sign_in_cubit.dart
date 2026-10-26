import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/merchant_user.dart';
import '../../domain/usecases/sign_in.dart';

part 'sign_in_state.dart';

/// Form-local state for the sign-in page. On success the page tells
/// [AuthBloc] via AuthUserChanged.
class SignInCubit extends Cubit<SignInState> {
  SignInCubit(this._signIn) : super(const SignInState());

  final SignIn _signIn;

  Future<void> submit({required String email, required String password}) async {
    emit(state.copyWith(status: SignInStatus.submitting, clearError: true));
    final result = await _signIn(SignInParams(email: email, password: password));
    emit(result.fold(
      (failure) => state.copyWith(status: SignInStatus.failure, error: failure.message),
      (user) => state.copyWith(status: SignInStatus.success, user: user),
    ));
  }
}
