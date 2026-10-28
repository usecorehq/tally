import 'package:dartz/dartz.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/business.dart';
import '../../domain/entities/business_vertical.dart';
import '../../domain/entities/starter_items.dart';
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

  @override
  Future<Either<Failure, List<BusinessVertical>>> getVerticals() async {
    try {
      return Right(await _remote.getVerticals());
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }

  @override
  Future<Either<Failure, Business>> createBusiness({required String name, required String subtypeCode}) async {
    try {
      return Right(await _remote.createBusiness(name: name, subtypeCode: subtypeCode));
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }

  @override
  Future<Either<Failure, List<StarterRow>>> getStarterRows(String subtypeCode) async {
    try {
      return Right(await _remote.getStarterRows(subtypeCode));
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }

  @override
  Future<Either<Failure, StarterResult>> submitStarter(String businessId, List<Map<String, Object?>> items) async {
    try {
      return Right(await _remote.submitStarter(businessId, items));
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }
}
