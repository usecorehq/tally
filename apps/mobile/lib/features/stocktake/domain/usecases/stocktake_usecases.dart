import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/photo_check.dart';
import '../entities/shelf_scan.dart';
import '../entities/stocktake_history.dart';
import '../repositories/stocktake_repository.dart';
import '../scan_review.dart';

/// The API's limit for a shelf photo.
const kMaxShelfPhotoBytes = 4 * 1024 * 1024;

/// The API's limit for a photo check (send a ~1024 px copy).
const kMaxCheckPhotoBytes = 1024 * 1024;

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
/// Only called once every line passed [ScanProblems].
class ConfirmScan implements UseCase<ScanConfirmResult, ConfirmScanParams> {
  const ConfirmScan(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, ScanConfirmResult>> call(ConfirmScanParams p) async {
    if (p.detections.any((d) => ScanProblems.of(p.choices[d.id]!).any)) {
      return const Left(
        ServerFailure('Every line needs an action, a count and, when adding, a product, name and price.'),
      );
    }
    return _repository.confirm(p.businessId, p.scanId, [for (final d in p.detections) toDecision(d, p.choices[d.id]!)]);
  }
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

class HistoryParams extends Equatable {
  const HistoryParams({required this.businessId, this.limit = 50});
  final String businessId;

  /// 1–100.
  final int limit;

  @override
  List<Object?> get props => [businessId, limit];
}

/// GET …/vision/stocktakes: newest first, reruns nested under their root.
class GetStocktakeHistory implements UseCase<List<HistoryEntry>, HistoryParams> {
  const GetStocktakeHistory(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, List<HistoryEntry>>> call(HistoryParams p) =>
      _repository.history(p.businessId, limit: p.limit.clamp(1, 100));
}

class ScanParams extends Equatable {
  const ScanParams({required this.businessId, required this.scanId});
  final String businessId;
  final String scanId;

  @override
  List<Object?> get props => [businessId, scanId];
}

/// A stored scan, reopened (status, photo and each line's decision).
class GetScan implements UseCase<ShelfScan, ScanParams> {
  const GetScan(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, ShelfScan>> call(ScanParams p) => _repository.getScan(p.businessId, p.scanId);
}

/// A new agent run on the stored photo; poll it with [GetStocktake]. 409 → ConflictFailure.
class RerunScan implements UseCase<ScanRerun, ScanParams> {
  const RerunScan(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, ScanRerun>> call(ScanParams p) => _repository.rerun(p.businessId, p.scanId);
}

/// Read-only from now on, kept for audit. Idempotent; 409 → ConflictFailure.
class DiscardScan implements UseCase<DateTime?, ScanParams> {
  const DiscardScan(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, DateTime?>> call(ScanParams p) => _repository.discard(p.businessId, p.scanId);
}

/// Advice before a scan, never a block.
class CheckPhoto implements UseCase<PhotoCheck, ScanPhotoParams> {
  const CheckPhoto(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, PhotoCheck>> call(ScanPhotoParams p) async {
    if (p.photo.bytes.length > kMaxCheckPhotoBytes) {
      return const Left(ServerFailure('That photo is too large (1 MB max). Try a smaller one.'));
    }
    return _repository.checkPhoto(p.businessId, p.photo.bytes, p.photo.mimeType);
  }
}

/// A presigned photo or crop link (`photoUrl`, `cropUrl`) as bytes. 404 → NotFoundFailure.
class DownloadPhoto implements UseCase<Uint8List, String> {
  const DownloadPhoto(this._repository);
  final StocktakeRepository _repository;

  @override
  Future<Either<Failure, Uint8List>> call(String url) => _repository.downloadPhoto(url);
}
