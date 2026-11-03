import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/catalogue_product.dart';

abstract class CatalogueRepository {
  Future<Either<Failure, List<CatalogueProduct>>> search(String q, {int limit = 10});

  /// A merged product is followed once. 404 → NotFoundFailure.
  Future<Either<Failure, CatalogueProductDetail>> product(String qid);
}
