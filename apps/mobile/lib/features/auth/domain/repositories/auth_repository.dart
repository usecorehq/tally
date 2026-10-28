import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/merchant_user.dart';

abstract class AuthRepository {
  /// [EmailNotConfirmedFailure] when the password is right but the email was never confirmed.
  Future<Either<Failure, MerchantUser>> signIn({
    required String email,
    required String password,
  });

  Future<Either<Failure, Unit>> signOut();

  /// The restored session's user, or `null` when signed out.
  Either<Failure, MerchantUser?> currentUser();

  /// A new shared Qorelly account. `Right(null)`: a confirmation code was
  /// emailed; `Right(user)`: signed in straight away.
  Future<Either<Failure, MerchantUser?>> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  });

  /// Confirm an emailed code; signs in. [recovery] is the password-reset code.
  Future<Either<Failure, MerchantUser>> verifyEmailCode({
    required String email,
    required String code,
    required bool recovery,
  });

  Future<Either<Failure, Unit>> resendSignupCode(String email);

  Future<Either<Failure, Unit>> requestPasswordReset(String email);

  /// The signed-in (recovery) session's new password.
  Future<Either<Failure, MerchantUser>> updatePassword(String password);
}
