import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/business.dart';

abstract class BusinessRepository {
  /// Businesses the signed-in user belongs to.
  Future<Either<Failure, List<Business>>> getMyBusinesses();
}
