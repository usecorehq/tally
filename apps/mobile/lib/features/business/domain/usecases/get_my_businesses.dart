import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/business.dart';
import '../repositories/business_repository.dart';

class GetMyBusinesses implements UseCase<List<Business>, NoParams> {
  const GetMyBusinesses(this._repository);
  final BusinessRepository _repository;

  @override
  Future<Either<Failure, List<Business>>> call(NoParams params) => _repository.getMyBusinesses();
}
