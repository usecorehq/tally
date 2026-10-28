import 'dart:typed_data';

import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/shelf_scan.dart';

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
}
