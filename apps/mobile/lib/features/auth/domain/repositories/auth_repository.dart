import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/merchant_user.dart';

abstract class AuthRepository {
  Future<Either<Failure, MerchantUser>> signIn({
    required String email,
    required String password,
  });

  Future<Either<Failure, Unit>> signOut();

  /// The restored session's user, or `null` when signed out.
  Either<Failure, MerchantUser?> currentUser();
}
