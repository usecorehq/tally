import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/business.dart';
import '../entities/business_vertical.dart';
import '../entities/starter_items.dart';
import '../repositories/business_repository.dart';

class GetBusinessVerticals implements UseCase<List<BusinessVertical>, NoParams> {
  const GetBusinessVerticals(this._repository);
  final BusinessRepository _repository;

  @override
  Future<Either<Failure, List<BusinessVertical>>> call(NoParams params) => _repository.getVerticals();
}

/// Same checks as the API (name 1–120 characters, a sub-type picked), with mp's copy.
class CreateBusiness implements UseCase<Business, CreateBusinessParams> {
  const CreateBusiness(this._repository);
  final BusinessRepository _repository;

  @override
  Future<Either<Failure, Business>> call(CreateBusinessParams p) async {
    final name = p.name.trim();
    if (name.isEmpty) return const Left(ServerFailure('Enter your business name.'));
    if (name.length > 120) return const Left(ServerFailure('Keep the business name under 120 characters.'));
    if (p.subtypeCode.isEmpty) return const Left(ServerFailure('Choose your industry and business type.'));
    return _repository.createBusiness(name: name, subtypeCode: p.subtypeCode);
  }
}

class CreateBusinessParams extends Equatable {
  const CreateBusinessParams({required this.name, required this.subtypeCode});
  final String name;
  final String subtypeCode;

  @override
  List<Object?> get props => [name, subtypeCode];
}

class GetStarterRows implements UseCase<List<StarterRow>, String> {
  const GetStarterRows(this._repository);
  final BusinessRepository _repository;

  @override
  Future<Either<Failure, List<StarterRow>>> call(String subtypeCode) => _repository.getStarterRows(subtypeCode);
}

/// Every row goes up — kept and removed — so the catalogue hears each decision.
class SubmitStarterItems implements UseCase<StarterResult, SubmitStarterParams> {
  const SubmitStarterItems(this._repository);
  final BusinessRepository _repository;

  @override
  Future<Either<Failure, StarterResult>> call(SubmitStarterParams p) =>
      _repository.submitStarter(p.businessId, [for (final r in p.rows) toStarterItem(r, p.choices[r.key]!)]);
}

class SubmitStarterParams extends Equatable {
  const SubmitStarterParams({required this.businessId, required this.rows, required this.choices});
  final String businessId;
  final List<StarterRow> rows;
  final Map<String, StarterChoice> choices;

  @override
  List<Object?> get props => [businessId, rows, choices];
}
