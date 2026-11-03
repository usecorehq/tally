import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/exceptions.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/stocktake/data/datasources/stocktake_remote_data_source.dart';
import 'package:qore_tally/features/stocktake/data/datasources/stored_photo_data_source.dart';
import 'package:qore_tally/features/stocktake/data/models/shelf_scan_model.dart';
import 'package:qore_tally/features/stocktake/data/repositories/stocktake_repository_impl.dart';
import 'package:qore_tally/features/stocktake/domain/entities/photo_check.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/entities/stocktake_history.dart';

class _Remote extends Mock implements StocktakeRemoteDataSource {}

class _Photos extends Mock implements StoredPhotoDataSource {}

// The shapes of apps/api's vision routes (vision.service.ts ScanView, HistoryEntry, getStocktake; photo-check.ts).

Map<String, dynamic> _scanView() => {
  'scanId': 'scan-2',
  'status': 'open',
  'createdAt': '2026-10-29T09:12:00.000Z',
  'confirmedAt': null,
  'discardedAt': null,
  'supersededAt': null,
  'rerunOf': 'scan-1',
  'canRerun': true,
  'model': 'muse-spark-1.3',
  'countModel': 'sam-3.1',
  'catalogueAvailable': true,
  'candidateDetails': false,
  'photoUrl': 'https://r2.example/tally/scans/scan-2.jpg?X-Amz-Signature=x',
  'detections': [
    {
      'id': 'd1',
      'position': 0,
      'brand': 'Brand A',
      'name': 'Drink',
      'pack': '50cl',
      'look': 'red bottle',
      'count': 6,
      'countSource': 'sam',
      'sparkCount': 5,
      'samCount': 6,
      'boxes': [
        {'x1': 100, 'y1': 200, 'x2': 180, 'y2': 390},
      ],
      'confidence': 'high',
      'candidates': [
        {
          'qid': 'QC-1',
          'score': 0.94,
          'match': 'strong',
          'name': 'Brand A Drink 50cl',
          'brand': 'Brand A',
          'variantLabel': '50cl',
          'size': {'value': 50, 'unit': 'cl'},
          'packQty': 1,
          'price': {'median': 500, 'min': 450, 'max': 600},
          'image': {'url': 'https://catalog.example/p.webp', 'width': 800, 'height': null},
          'inventoryItemId': 'item-1',
        },
        {'qid': 'QC-2', 'score': 0.4},
      ],
      'inventoryItemId': 'item-1',
      'inventoryMatch': 'catalogue',
      'inventoryItemArchived': false,
      'inventoryItemName': 'Brand A Drink 50cl',
      'inventoryNeedsConfirm': false,
      'review': null,
      'evidence': [
        {'turn': 3, 'tool': 'zoom', 'summary': 'read the label of "Brand A Drink" up close'},
      ],
      'cropUrl': 'https://r2.example/tally/crops/scan-2/0.webp?X-Amz-Signature=y',
      'decision': {
        'action': 'restock',
        'itemId': 'item-1',
        'itemName': 'Brand A Drink 50cl',
        'quantity': 6,
        'confirmedQid': 'QC-1',
        'decidedAt': '2026-10-29T09:20:31.000Z',
      },
    },
  ],
};

void main() {
  test('a reopened scan parses: status, photo, candidate details, crop, decision and evidence', () {
    final scan = shelfScanFromJson(_scanView());
    expect(scan.status, ScanStatus.open);
    expect(scan.readOnly, isFalse);
    expect(scan.createdAt, DateTime.utc(2026, 10, 29, 9, 12));
    expect(scan.rerunOf, 'scan-1');
    expect(scan.canRerun, isTrue);
    expect(scan.candidateDetails, isFalse);
    expect(scan.photoUrl, startsWith('https://r2.example/'));
    final d = scan.detections.single;
    expect(d.position, 0);
    expect(d.inventoryItemName, 'Brand A Drink 50cl');
    expect(d.cropUrl, contains('crops'));
    expect(d.decision?.action, 'restock');
    expect(d.decision?.decidedAt, DateTime.utc(2026, 10, 29, 9, 20, 31));
    expect(d.evidence.single.tool, 'zoom');
    final top = d.candidates.first;
    expect(top.match, MatchStrength.strong);
    expect(top.size, const ScanSize(50, 'cl'));
    expect(top.image, const CatalogImage(url: 'https://catalog.example/p.webp', width: 800));
    expect(top.variantLabel, '50cl');
    final bare = d.candidates.last;
    expect((bare.name, bare.match, bare.priceMedian, bare.packQty), (null, null, null, 1));
  });

  test('a quick-scan result defaults to open with no dates', () {
    final scan = shelfScanFromJson({'scanId': 's', 'photoStored': true, 'detections': []});
    expect(scan.status, ScanStatus.open);
    expect(scan.createdAt, isNull);
    expect(scan.photoStored, isTrue);
    expect(scan.candidateDetails, isTrue);
  });

  test('a run parses its id, times and photo; an unknown status reads as running', () {
    final run = stocktakeRunFromJson({
      'run': {
        'id': 'run-2',
        'status': 'done',
        'scanId': 'scan-2',
        'rerunOfScanId': 'scan-1',
        'turns': 9,
        'error': null,
        'startedAt': '2026-10-29T09:10:00.000Z',
        'finishedAt': '2026-10-29T09:12:00.000Z',
      },
      'photoUrl': 'https://r2.example/p.jpg',
      'steps': [],
      'result': _scanView(),
    });
    expect((run.runId, run.scanId, run.rerunOfScanId), ('run-2', 'scan-2', 'scan-1'));
    expect(run.finishedAt, DateTime.utc(2026, 10, 29, 9, 12));
    expect(run.photoUrl, 'https://r2.example/p.jpg');
    expect(run.result?.scanId, 'scan-2');
    expect(
      stocktakeRunFromJson({
        'run': {'status': 'paused'},
      }).status,
      StocktakeStatus.running,
    );
  });

  test('confirm reports runs it superseded', () {
    final r = confirmResultFromJson({
      'created': 0,
      'restocked': 1,
      'restored': 0,
      'skipped': 0,
      'scanConfirmed': true,
      'superseded': 2,
      'feedback': {'sent': 1, 'recorded': 1, 'duplicates': 0},
    });
    expect((r.scanConfirmed, r.superseded), (true, 2));
  });

  test('history parses with reruns nested, oldest first', () {
    final entries = historyFromJson([
      {
        'id': 'run-1',
        'kind': 'stocktake',
        'runId': 'run-1',
        'scanId': 'scan-1',
        'status': 'superseded',
        'rerunOf': null,
        'fallback': false,
        'startedAt': '2026-10-29T09:00:00.000Z',
        'confirmedAt': null,
        'error': null,
        'lines': 8,
        'decided': {'add': 0, 'restock': 0, 'restore': 0, 'skip': 0},
        'preview': ['Brand A', 'Brand B'],
        'reruns': [
          {
            'id': 'run-2',
            'kind': 'stocktake',
            'runId': 'run-2',
            'scanId': 'scan-2',
            'status': 'confirmed',
            'rerunOf': 'scan-1',
            'fallback': true,
            'startedAt': '2026-10-29T09:10:00.000Z',
            'confirmedAt': '2026-10-29T09:20:31.000Z',
            'error': null,
            'lines': 7,
            'decided': {'add': 2, 'restock': 4, 'restore': 0, 'skip': 1},
            'preview': ['Brand A'],
            'reruns': [],
          },
          {
            'id': 'run-3',
            'kind': 'stocktake',
            'runId': 'run-3',
            'scanId': null,
            'status': 'failed',
            'rerunOf': 'scan-1',
            'fallback': false,
            'startedAt': '2026-10-29T09:30:00.000Z',
            'confirmedAt': null,
            'error': 'First pass failed',
            'lines': null,
            'decided': {'add': 0, 'restock': 0, 'restore': 0, 'skip': 0},
            'preview': [],
          },
        ],
      },
      {'id': 'scan-9', 'kind': 'quick', 'status': 'review', 'startedAt': '2026-10-28T08:00:00.000Z'},
    ]);
    final root = entries.first;
    expect(root.status, HistoryStatus.superseded);
    expect(root.preview, ['Brand A', 'Brand B']);
    expect(root.reruns.map((e) => e.id), ['run-2', 'run-3']);
    final rerun = root.reruns.first;
    expect((rerun.rerunOf, rerun.fallback, rerun.decided.total, rerun.decided.restock), ('scan-1', true, 7, 4));
    expect(root.reruns.last.lines, isNull);
    expect(root.reruns.last.error, 'First pass failed');
    final quick = entries.last;
    expect(
      (quick.kind, quick.runId, quick.reruns.length, quick.decided),
      (HistoryKind.quick, null, 0, const DecidedLines()),
    );
  });

  test('a photo check parses; unknown issues are dropped', () {
    final check = photoCheckFromJson({
      'verdict': 'retake',
      'issues': ['too_far', 'cut_off', 'something_new'],
      'instruction': 'Step closer so one or two shelves fill the photo.',
      'productsVisible': 30,
      'labelsLegible': 'few',
      'region': {'x1': 420, 'y1': 120, 'x2': 980, 'y2': 560},
      'model': 'muse-spark-1.3',
      'ms': 2400,
    });
    expect(check.verdict, PhotoVerdict.retake);
    expect(check.issues, [PhotoIssue.tooFar, PhotoIssue.cutOff]);
    expect(check.labelsLegible, LabelsLegible.few);
    expect(check.region, const ScanBox(420, 120, 980, 560));
    expect(photoCheckFromJson({'verdict': 'good', 'region': null}).region, isNull);
  });

  group('errors', () {
    DioException http(int status, Object? body) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      response: Response(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: status,
        data: body,
      ),
      type: DioExceptionType.badResponse,
    );

    test("409 keeps the API's message", () {
      const message = "This stock-take's photo wasn't kept, so it can't be rerun. Take new stock instead.";
      final e = visionException(http(409, {'statusCode': 409, 'message': message}));
      expect((e.statusCode, e.message), (409, message));
      expect(visionException(http(413, null), maxMb: 1).message, contains('1 MB'));
    });

    test('the repository maps 409 to ConflictFailure and 404 to NotFoundFailure', () async {
      final remote = _Remote();
      final photos = _Photos();
      final repo = StocktakeRepositoryImpl(remote, photos);
      when(() => remote.rerun('b', 's')).thenThrow(const ServerException('Already confirmed.', statusCode: 409));
      when(() => remote.discard('b', 's')).thenThrow(const ServerException('Only an open one.', statusCode: 409));
      when(() => photos.fetch('u')).thenThrow(const ServerException("This photo wasn't kept.", statusCode: 404));
      expect(await repo.rerun('b', 's'), const Left<Failure, ScanRerun>(ConflictFailure('Already confirmed.')));
      expect((await repo.discard('b', 's')).fold((f) => f, (_) => null), isA<ConflictFailure>());
      expect((await repo.downloadPhoto('u')).fold((f) => f, (_) => null), isA<NotFoundFailure>());

      when(() => photos.fetch('ok')).thenAnswer((_) async => Uint8List.fromList([1, 2]));
      expect((await repo.downloadPhoto('ok')).getOrElse(() => Uint8List(0)), [1, 2]);
    });
  });
}
