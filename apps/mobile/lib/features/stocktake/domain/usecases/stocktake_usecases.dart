import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/shelf_scan.dart';
import '../repositories/stocktake_repository.dart';
import '../scan_review.dart';

/// The API's limit for a shelf photo.
const kMaxShelfPhotoBytes = 4 * 1024 * 1024;

class ShelfPhoto extends Equatable {
  const ShelfPhoto({required this.bytes, required this.mimeType});
  final Uint8List bytes;

  /// image/jpeg, image/png or image/webp.
  final String mimeType;

  @override
  List<Object?> get props => [bytes.length, mimeType];
}

class ScanPhotoParams extends Equatable {
  const ScanPhotoParams({required this.businessId, required this.photo});
  final String businessId;
  final ShelfPhoto photo;

  @override
  List<Object?> get props => [businessId, photo];
}

Failure? _tooLarge(ShelfPhoto p) => p.bytes.length > kMaxShelfPhotoBytes
    ? const ServerFailure('That photo is too large (4 MB max). Try a smaller one.')
    : null;

class QuickScan implements UseCase<ShelfScan, ScanPhotoParams> {
  const QuickScan(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, ShelfScan>> call(ScanPhotoParams p) async {
    if (_tooLarge(p.photo) case final f?) return Left(f);
    return _repository.quickScan(p.businessId, p.photo.bytes, p.photo.mimeType);
  }
}

class StartStocktake implements UseCase<String, ScanPhotoParams> {
  const StartStocktake(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, String>> call(ScanPhotoParams p) async {
    if (_tooLarge(p.photo) case final f?) return Left(f);
    return _repository.startStocktake(p.businessId, p.photo.bytes, p.photo.mimeType);
  }
}

class GetStocktake implements UseCase<StocktakeRun, RunParams> {
  const GetStocktake(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, StocktakeRun>> call(RunParams p) => _repository.getStocktake(p.businessId, p.runId);
}

class RunParams extends Equatable {
  const RunParams({required this.businessId, required this.runId});
  final String businessId;
  final String runId;

  @override
  List<Object?> get props => [businessId, runId];
}

/// Every line goes up — skipped ones too — so the catalogue hears each decision.
class ConfirmScan implements UseCase<ScanConfirmResult, ConfirmScanParams> {
  const ConfirmScan(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, ScanConfirmResult>> call(ConfirmScanParams p) =>
      _repository.confirm(p.businessId, p.scanId, [for (final d in p.detections) toDecision(d, p.choices[d.id]!)]);
}

class ConfirmScanParams extends Equatable {
  const ConfirmScanParams({
    required this.businessId,
    required this.scanId,
    required this.detections,
    required this.choices,
  });
  final String businessId;
  final String scanId;
  final List<ScanDetection> detections;
  final Map<String, ScanChoice> choices;

  @override
  List<Object?> get props => [businessId, scanId, detections, choices];
}
