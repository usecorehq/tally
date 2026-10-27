import 'package:dartz/dartz.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/business.dart';
import '../../domain/repositories/business_repository.dart';
import '../datasources/business_remote_data_source.dart';

class BusinessRepositoryImpl implements BusinessRepository {
  const BusinessRepositoryImpl(this._remote);
  final BusinessRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<Business>>> getMyBusinesses() async {
    try {
      return Right(await _remote.getMyBusinesses());
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }
}
