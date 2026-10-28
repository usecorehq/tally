import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/business.dart';
import '../entities/business_vertical.dart';
import '../entities/starter_items.dart';

abstract class BusinessRepository {
  /// Businesses the signed-in user belongs to.
  Future<Either<Failure, List<Business>>> getMyBusinesses();

  /// Qore Catalog business types and their sub-types.
  Future<Either<Failure, List<BusinessVertical>>> getVerticals();

  /// A new business owned by the caller.
  Future<Either<Failure, Business>> createBusiness({required String name, required String subtypeCode});

  /// Starter template rows for a sub-type, with catalogue suggestions.
  Future<Either<Failure, List<StarterRow>>> getStarterRows(String subtypeCode);

  /// Apply the merchant's choices: kept rows become inventory with opening stock.
  Future<Either<Failure, StarterResult>> submitStarter(String businessId, List<Map<String, Object?>> items);
}
