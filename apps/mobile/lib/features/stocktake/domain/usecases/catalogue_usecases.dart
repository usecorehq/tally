import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/catalogue_product.dart';
import '../repositories/catalogue_repository.dart';

/// The API's shortest query.
const kMinCatalogueQuery = 2;

/// The picker's catalogue search (signed-in route; the catalogue key stays in apps/api).
class SearchCatalogue implements UseCase<List<CatalogueProduct>, String> {
  const SearchCatalogue(this._repository);
  final CatalogueRepository _repository;

  @override
  Future<Either<Failure, List<CatalogueProduct>>> call(String q) async {
    final query = q.trim();
    if (query.length < kMinCatalogueQuery) return const Right([]);
    return _repository.search(query.length > 200 ? query.substring(0, 200) : query, limit: 10);
  }
}

/// One product with its price and other sizes, by Qore ID.
class GetCatalogueProduct implements UseCase<CatalogueProductDetail, String> {
  const GetCatalogueProduct(this._repository);
  final CatalogueRepository _repository;

  @override
  Future<Either<Failure, CatalogueProductDetail>> call(String qid) => _repository.product(qid);
}
