import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/stocktake/data/datasources/catalogue_remote_data_source.dart';
import 'package:qore_tally/features/stocktake/data/models/catalogue_model.dart';
import 'package:qore_tally/features/stocktake/data/repositories/catalogue_repository_impl.dart';
import 'package:qore_tally/features/stocktake/domain/entities/catalogue_product.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';

// The shapes of GET /api/catalog/products and /api/catalog/products/:qid (@tally/catalog-client types).

Map<String, dynamic> _product(String qid, {Object? price, List<Object?> variants = const []}) => {
  'qid': qid,
  'name': 'Brand A Drink 50cl',
  'variantLabel': null,
  'size': {'value': 50, 'unit': 'cl'},
  'packQty': 1,
  'status': 'active',
  'family': {'slug': 'brand-a-drink', 'name': 'Brand A Drink'},
  'brand': {'slug': 'brand-a', 'name': 'Brand A'},
  'category': {'path': 'drinks/soft', 'name': 'Soft drinks'},
  'image': {'url': 'https://img.example/$qid.jpg', 'width': 400, 'height': null},
  'price': ?price,
  'variants': variants,
};

/// Answers each GET path from [routes]; records the requests.
class _Adapter implements HttpClientAdapter {
  _Adapter(this.routes);
  final Map<String, (int, Object)> routes;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? _, Future<void>? _) async {
    requests.add(options);
    final (status, body) = routes[options.path] ?? (404, {'message': 'Not found'});
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

(CatalogueRepositoryImpl, _Adapter) _repo(Map<String, (int, Object)> routes) {
  final adapter = _Adapter(routes);
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example/api'))..httpClientAdapter = adapter;
  return (CatalogueRepositoryImpl(CatalogueRemoteDataSourceImpl(dio)), adapter);
}

void main() {
  test('search hits, with sizes, brand and picture', () {
    final hits = catalogueSearchFromJson({
      'total': 2,
      'limit': 10,
      'offset': 0,
      'items': [
        {..._product('QC-1'), 'score': 0.9},
        {'qid': 'QC-2', 'name': 'Bare', 'packQty': 6, 'image': null, 'brand': null, 'size': null},
      ],
    });
    expect(hits[0].size, const ScanSize(50, 'cl'));
    expect(hits[0].brand, 'Brand A');
    expect(hits[0].image, const CatalogImage(url: 'https://img.example/QC-1.jpg', width: 400));
    expect(hits[1].image, isNull);
    expect(sizeLabel(variantLabel: hits[1].variantLabel, size: hits[1].size, packQty: hits[1].packQty), '× 6');
  });

  test('a product: price rounded to whole Naira, variants kept', () {
    final p = catalogueProductFromJson(
      _product(
        'QC-1',
        price: {'currency': 'NGN', 'median': 450.4, 'min': 400, 'max': 520, 'offers': 3, 'retailers': 2},
        variants: [
          {'qid': 'QC-1', 'variantLabel': '50cl', 'packQty': 1},
          {'qid': 'QC-3', 'variantLabel': null, 'packQty': 12},
        ],
      ),
    );
    expect((p.priceMedian, p.priceMin, p.priceMax), (450, 400, 520));
    expect(p.variants.last, const CatalogueVariant(qid: 'QC-3', packQty: 12));
    expect(p.toCandidate().label, 'Brand A Drink 50cl');
  });

  test('a product without a price', () {
    expect(catalogueProductFromJson(_product('QC-1', price: null)).priceMedian, isNull);
  });

  test('size labels', () {
    expect(sizeLabel(variantLabel: '6 × 50cl', size: const ScanSize(50, 'cl')), '6 × 50cl');
    expect(sizeLabel(size: const ScanSize(400, 'g'), packQty: 6), '400g × 6');
    expect(sizeLabel(), isNull);
  });

  test('search asks for 10 with the query', () async {
    final (repo, adapter) = _repo({
      '/catalog/products': (200, {'total': 0, 'limit': 10, 'offset': 0, 'items': <Object>[]}),
    });
    final res = await repo.search('drink', limit: 10);
    expect(res.isRight(), isTrue);
    expect(adapter.requests.single.queryParameters, {'q': 'drink', 'limit': 10});
  });

  test('a merged product is followed once', () async {
    final (repo, adapter) = _repo({
      '/catalog/products/QC-OLD': (200, {'qid': 'QC-OLD', 'status': 'merged', 'mergedInto': 'QC-NEW'}),
      '/catalog/products/QC-NEW': (200, _product('QC-NEW')),
    });
    final res = await repo.product('QC-OLD');
    expect(res.getOrElse(() => throw StateError('failed')).qid, 'QC-NEW');
    expect(adapter.requests, hasLength(2));
  });

  test('404 → NotFoundFailure; 503 → the busy message', () async {
    final (repo, _) = _repo({
      '/catalog/products/QC-BUSY': (503, {'message': 'Upstream error'}),
    });
    expect((await repo.product('QC-NONE')).fold((f) => f, (_) => null), isA<NotFoundFailure>());
    expect(
      (await repo.product('QC-BUSY')).fold((f) => f.message, (_) => null),
      'The catalogue is busy. Try again in a moment.',
    );
  });
}
