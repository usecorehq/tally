import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/merchant_user.dart';
import '../../domain/usecases/get_current_user.dart';
import '../../domain/usecases/sign_out.dart';

part 'auth_event.dart';
part 'auth_state.dart';

/// App-wide session state. Drives which top-level page is shown.
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({required GetCurrentUser getCurrentUser, required SignOut signOut})
      : _getCurrentUser = getCurrentUser,
        _signOut = signOut,
        super(const AuthUnknown()) {
    on<AuthStarted>(_onStarted);
    on<AuthUserChanged>(_onUserChanged);
    on<AuthSignOutRequested>(_onSignOutRequested);
  }

  final GetCurrentUser _getCurrentUser;
  final SignOut _signOut;

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    final result = await _getCurrentUser(const NoParams());
    emit(result.fold(
      (_) => const Unauthenticated(),
      (user) => user == null ? const Unauthenticated() : Authenticated(user),
    ));
  }

  void _onUserChanged(AuthUserChanged event, Emitter<AuthState> emit) {
    final user = event.user;
    emit(user == null ? const Unauthenticated() : Authenticated(user));
  }

  Future<void> _onSignOutRequested(AuthSignOutRequested event, Emitter<AuthState> emit) async {
    await _signOut(const NoParams());
    emit(const Unauthenticated());
  }
}
