import 'dart:async';
import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/stocktake/domain/entities/catalogue_product.dart';
import 'package:qore_tally/features/stocktake/domain/entities/photo_check.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/photo_quality.dart';
import 'package:qore_tally/features/stocktake/domain/repositories/photo_tools.dart';
import 'package:qore_tally/features/stocktake/domain/scan_review.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/catalogue_usecases.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/stocktake_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/photo_check_cubit.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/product_picker_cubit.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/scan_review_cubit.dart';

class _CheckPhoto extends Mock implements CheckPhoto {}

class _Tools extends Mock implements PhotoTools {}

class _Search extends Mock implements SearchCatalogue {}

class _Product extends Mock implements GetCatalogueProduct {}

class _Confirm extends Mock implements ConfirmScan {}

final _photo = ShelfPhoto(bytes: Uint8List(10), mimeType: 'image/jpeg');
final _copy = ShelfPhoto(bytes: Uint8List(5), mimeType: 'image/png');
const _verdict = PhotoCheck(verdict: PhotoVerdict.good, productsVisible: 12, labelsLegible: LabelsLegible.most);

const _hit = CatalogueProduct(qid: 'QC-9', name: 'Brand B Snack 100g');
const _detail = CatalogueProductDetail(
  qid: 'QC-9',
  name: 'Brand B Snack 100g',
  priceMedian: 900,
  variants: [
    CatalogueVariant(qid: 'QC-9'),
    CatalogueVariant(qid: 'QC-10', variantLabel: '200g'),
  ],
);

void main() {
  setUpAll(() {
    registerFallbackValue(ScanPhotoParams(businessId: '', photo: _photo));
    registerFallbackValue(_photo);
    registerFallbackValue(Uint8List(0));
  });

  group('PhotoCheckCubit', () {
    late _CheckPhoto check;
    late _Tools tools;
    setUp(() {
      check = _CheckPhoto();
      tools = _Tools();
      when(() => tools.localCheck(any())).thenAnswer((_) async => const LocalPhotoCheck(blurry: true));
      when(() => tools.checkCopy(any())).thenAnswer((_) async => _copy);
    });

    test('local checks first, then the verdict on the copy', () async {
      when(() => check(any())).thenAnswer((_) async => const Right(_verdict));
      final cubit = PhotoCheckCubit(businessId: 'b1', checkPhoto: check, tools: tools);
      final states = <PhotoCheckState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.check(_photo);
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();
      expect(states, const [
        PhotoCheckState(),
        PhotoCheckState(local: LocalPhotoCheck(blurry: true)),
        PhotoCheckState(local: LocalPhotoCheck(blurry: true), result: _verdict, done: true),
      ]);
      final sent = verify(() => check(captureAny())).captured.single as ScanPhotoParams;
      expect(sent.photo, _copy);
      expect(sent.businessId, 'b1');
    });

    test('a failed check ends with no verdict, keeping the local findings', () async {
      when(() => check(any())).thenAnswer((_) async => const Left(ServerFailure('busy')));
      final cubit = PhotoCheckCubit(businessId: 'b1', checkPhoto: check, tools: tools);
      await cubit.check(_photo);
      expect(cubit.state, const PhotoCheckState(local: LocalPhotoCheck(blurry: true), done: true));
    });

    test('no copy under 1 MB: no model check', () async {
      when(() => tools.checkCopy(any())).thenAnswer((_) async => null);
      final cubit = PhotoCheckCubit(businessId: 'b1', checkPhoto: check, tools: tools);
      await cubit.check(_photo);
      expect(cubit.state.done, isTrue);
      expect(cubit.state.result, isNull);
      verifyNever(() => check(any()));
    });

    test('a newer photo wins over a late verdict', () async {
      final late = Completer<Either<Failure, PhotoCheck>>();
      when(() => check(any())).thenAnswer((_) => late.future);
      final cubit = PhotoCheckCubit(businessId: 'b1', checkPhoto: check, tools: tools);
      final first = cubit.check(_photo);
      await Future<void>.delayed(Duration.zero);
      cubit.reset();
      late.complete(const Right(_verdict));
      await first;
      expect(cubit.state, const PhotoCheckState());
    });
  });

  group('ProductPickerCubit', () {
    late _Search search;
    late _Product product;
    setUp(() {
      search = _Search();
      product = _Product();
      when(() => product(any())).thenAnswer((_) async => const Right(_detail));
    });

    ProductPickerCubit cubit() =>
        ProductPickerCubit(search: search, product: product, debounce: const Duration(milliseconds: 20));

    test('debounced: only the last keystroke searches', () async {
      when(() => search(any())).thenAnswer((_) async => const Right([_hit]));
      final c = cubit()
        ..query('sn')
        ..query('sna')
        ..query('snack');
      expect(c.state.searching, isTrue);
      await Future<void>.delayed(const Duration(milliseconds: 60));
      verify(() => search('snack')).called(1);
      verifyNoMoreInteractions(search);
      expect(c.state.hits, [_hit]);
      expect(c.state.searching, isFalse);
    });

    test('the latest answer wins over a slower earlier one', () async {
      final slow = Completer<Either<Failure, List<CatalogueProduct>>>();
      when(() => search('old')).thenAnswer((_) => slow.future);
      when(() => search('new')).thenAnswer((_) async => const Right([_hit]));
      final c = cubit()..query('old');
      await Future<void>.delayed(const Duration(milliseconds: 40));
      c.query('new');
      await Future<void>.delayed(const Duration(milliseconds: 40));
      slow.complete(const Right([]));
      await Future<void>.delayed(Duration.zero);
      expect(c.state.hits, [_hit]);
    });

    test('under two characters: no search, no hits', () async {
      final c = cubit()..query(' s ');
      await Future<void>.delayed(const Duration(milliseconds: 40));
      verifyNever(() => search(any()));
      expect(c.state.hits, isNull);
      expect(c.state.searching, isFalse);
    });

    test('other sizes leave out the current pick', () async {
      final c = cubit();
      await c.loadSizes('QC-9');
      expect(c.state.sizes, const [CatalogueVariant(qid: 'QC-10', variantLabel: '200g')]);
    });

    test('picking fetches the product; a failure shows and returns null', () async {
      final c = cubit();
      expect(await c.pick('QC-9'), _detail);
      expect(c.state.busy, isNull);
      when(() => product('QC-X')).thenAnswer((_) async => const Left(ServerFailure('The catalogue is busy.')));
      expect(await c.pick('QC-X'), isNull);
      expect(c.state.error, 'The catalogue is busy.');
    });
  });

  group('chooseCatalogueProduct', () {
    const line = ScanDetection(
      id: 'a',
      brand: 'Brand B',
      name: 'Snack',
      pack: '',
      count: 4,
      candidates: [ScanCandidate(qid: 'QC-1', name: 'Brand B Snack 50g', score: 0.8, priceMedian: 500)],
    );
    ScanReviewCubit review() => ScanReviewCubit(
      businessId: 'b1',
      scan: const ShelfScan(scanId: 's1', detections: [line]),
      confirm: _Confirm(),
    );

    test('sets the product, its name and typical price', () {
      final c = review()..chooseCatalogueProduct('a', _detail);
      final choice = c.state.choices['a']!;
      expect((choice.choice, choice.name, choice.price), ('QC-9', 'Brand B Snack 100g', '900'));
      expect(c.state.pickedProduct(line)?.priceMedian, 900);
      expect(ScanProblems.of(choice).any, isFalse);
    });

    test('no price: the merchant\'s own stays', () {
      final c = review()
        ..setPrice('a', '650')
        ..chooseCatalogueProduct('a', const CatalogueProductDetail(qid: 'QC-11', name: 'Unpriced'));
      expect(c.state.choices['a']!.price, '650');
      expect(c.state.choices['a']!.name, 'Unpriced');
    });

    test('back to a suggestion: the catalogue pick no longer shows', () {
      final c = review()
        ..chooseCatalogueProduct('a', _detail)
        ..choose('a', 'QC-1');
      expect(c.state.pickedProduct(line)?.qid, 'QC-1');
      expect(c.state.choices['a']!.price, '500');
    });
  });
}
