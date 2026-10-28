import 'package:dartz/dartz.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/merchant_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._remote);
  final AuthRemoteDataSource _remote;

  @override
  Future<Either<Failure, MerchantUser>> signIn({
    required String email,
    required String password,
  }) => _run(() => _remote.signIn(email: email, password: password));

  @override
  Future<Either<Failure, Unit>> signOut() async {
    try {
      await _remote.signOut();
      return const Right(unit);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Either<Failure, MerchantUser?> currentUser() {
    try {
      return Right(_remote.currentUser());
    } catch (e) {
      return Left(AuthFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, MerchantUser?>> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) => _run(() => _remote.signUp(email: email, password: password, fullName: fullName, phone: phone));

  @override
  Future<Either<Failure, MerchantUser>> verifyEmailCode({
    required String email,
    required String code,
    required bool recovery,
  }) => _run(() => _remote.verifyEmailCode(email: email, code: code, recovery: recovery));

  @override
  Future<Either<Failure, Unit>> resendSignupCode(String email) => _run(() async {
    await _remote.resendSignupCode(email);
    return unit;
  });

  @override
  Future<Either<Failure, Unit>> requestPasswordReset(String email) => _run(() async {
    await _remote.requestPasswordReset(email);
    return unit;
  });

  @override
  Future<Either<Failure, MerchantUser>> updatePassword(String password) => _run(() => _remote.updatePassword(password));

  Future<Either<Failure, T>> _run<T>(Future<T> Function() call) async {
    try {
      return Right(await call());
    } on AuthException catch (e) {
      return Left(e.emailNotConfirmed ? EmailNotConfirmedFailure(e.message) : AuthFailure(e.message));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
