import 'dart:typed_data';

import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/photo_check.dart';
import '../entities/shelf_scan.dart';
import '../entities/stocktake_history.dart';

abstract class StocktakeRepository {
  /// The quick scan: one request, ~15–30 s.
  Future<Either<Failure, ShelfScan>> quickScan(String businessId, Uint8List image, String mimeType);

  /// Starts the stock-take agent; returns its run id.
  Future<Either<Failure, String>> startStocktake(String businessId, Uint8List image, String mimeType);

  Future<Either<Failure, StocktakeRun>> getStocktake(String businessId, String runId);

  Future<Either<Failure, ScanConfirmResult>> confirm(
    String businessId,
    String scanId,
    List<Map<String, Object?>> decisions,
  );

  /// Newest first; reruns nested under their root.
  Future<Either<Failure, List<HistoryEntry>>> history(String businessId, {int limit = 50});

  /// A stored scan, reopened. 404 → NotFoundFailure.
  Future<Either<Failure, ShelfScan>> getScan(String businessId, String scanId);

  /// 409 → ConflictFailure (no photo kept, or a run of it already moved stock).
  Future<Either<Failure, ScanRerun>> rerun(String businessId, String scanId);

  /// 409 → ConflictFailure (confirmed or superseded). Returns when it was discarded.
  Future<Either<Failure, DateTime?>> discard(String businessId, String scanId);

  Future<Either<Failure, PhotoCheck>> checkPhoto(String businessId, Uint8List image, String mimeType);

  /// A presigned photo or crop link's bytes. 404 → NotFoundFailure.
  Future<Either<Failure, Uint8List>> downloadPhoto(String url);
}
