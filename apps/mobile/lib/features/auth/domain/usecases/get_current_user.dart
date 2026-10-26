import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/merchant_user.dart';
import '../repositories/auth_repository.dart';

class GetCurrentUser implements UseCase<MerchantUser?, NoParams> {
  const GetCurrentUser(this._repository);
  final AuthRepository _repository;

  @override
  Future<Either<Failure, MerchantUser?>> call(NoParams params) async =>
      _repository.currentUser();
}
