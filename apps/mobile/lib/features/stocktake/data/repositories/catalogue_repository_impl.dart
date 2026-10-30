import 'package:dartz/dartz.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/catalogue_product.dart';
import '../../domain/repositories/catalogue_repository.dart';
import '../datasources/catalogue_remote_data_source.dart';

class CatalogueRepositoryImpl implements CatalogueRepository {
  const CatalogueRepositoryImpl(this._remote);
  final CatalogueRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<CatalogueProduct>>> search(String q, {int limit = 10}) =>
      _run(() => _remote.search(q, limit: limit));

  @override
  Future<Either<Failure, CatalogueProductDetail>> product(String qid) => _run(() => _remote.product(qid));

  Future<Either<Failure, T>> _run<T>(Future<T> Function() call) async {
    try {
      return Right(await call());
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }
}
