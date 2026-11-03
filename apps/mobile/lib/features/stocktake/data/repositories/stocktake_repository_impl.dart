import 'dart:typed_data';

import 'package:dartz/dartz.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_errors.dart';
import '../../domain/entities/photo_check.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/entities/stocktake_history.dart';
import '../../domain/repositories/stocktake_repository.dart';
import '../datasources/stocktake_remote_data_source.dart';
import '../datasources/stored_photo_data_source.dart';

class StocktakeRepositoryImpl implements StocktakeRepository {
  const StocktakeRepositoryImpl(this._remote, this._photos);
  final StocktakeRemoteDataSource _remote;
  final StoredPhotoDataSource _photos;

  @override
  Future<Either<Failure, ShelfScan>> quickScan(String businessId, Uint8List image, String mimeType) =>
      _run(() => _remote.quickScan(businessId, image, mimeType));

  @override
  Future<Either<Failure, String>> startStocktake(String businessId, Uint8List image, String mimeType) =>
      _run(() => _remote.startStocktake(businessId, image, mimeType));

  @override
  Future<Either<Failure, StocktakeRun>> getStocktake(String businessId, String runId) =>
      _run(() => _remote.getStocktake(businessId, runId));

  @override
  Future<Either<Failure, ScanConfirmResult>> confirm(
    String businessId,
    String scanId,
    List<Map<String, Object?>> decisions,
  ) => _run(() => _remote.confirm(businessId, scanId, decisions));

  @override
  Future<Either<Failure, List<HistoryEntry>>> history(String businessId, {int limit = 50}) =>
      _run(() => _remote.history(businessId, limit: limit));

  @override
  Future<Either<Failure, ShelfScan>> getScan(String businessId, String scanId) =>
      _run(() => _remote.getScan(businessId, scanId));

  @override
  Future<Either<Failure, ScanRerun>> rerun(String businessId, String scanId) =>
      _run(() => _remote.rerun(businessId, scanId));

  @override
  Future<Either<Failure, DateTime?>> discard(String businessId, String scanId) =>
      _run(() => _remote.discard(businessId, scanId));

  @override
  Future<Either<Failure, PhotoCheck>> checkPhoto(String businessId, Uint8List image, String mimeType) =>
      _run(() => _remote.checkPhoto(businessId, image, mimeType));

  @override
  Future<Either<Failure, Uint8List>> downloadPhoto(String url) => _run(() => _photos.fetch(url));

  Future<Either<Failure, T>> _run<T>(Future<T> Function() call) async {
    try {
      return Right(await call());
    } on ServerException catch (e) {
      return Left(toFailure(e));
    }
  }
}
