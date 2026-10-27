import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/inventory/domain/entities/inventory_item.dart';
import 'package:qore_tally/features/inventory/domain/usecases/inventory_usecases.dart';
import 'package:qore_tally/features/inventory/presentation/cubit/scan_cubit.dart';

class _GetInventory extends Mock implements GetInventory {}

class _FindByBarcode extends Mock implements FindByBarcode {}

class _LinkBarcode extends Mock implements LinkBarcode {}

const _biz = 'biz-1';
const _rice = InventoryItem(
  id: 'i1',
  name: 'Big Bull Rice 25kg',
  price: '49000.00',
  quantityOnHand: '12.000',
  barcode: '0036000291452',
);
const _beans = InventoryItem(id: 'i2', name: 'Honey Beans 2kg', price: '2500.50', quantityOnHand: '3.000');
const _zobo = InventoryItem(id: 'i3', name: "Mama's Zobo 50cl", price: '300.00', quantityOnHand: '24.000');

void main() {
  late _GetInventory getInventory;
  late _FindByBarcode findByBarcode;
  late _LinkBarcode linkBarcode;

  setUpAll(() {
    registerFallbackValue(const BarcodeParams(businessId: '', barcode: ''));
    registerFallbackValue(const LinkBarcodeParams(businessId: '', itemId: '', barcode: ''));
  });

  setUp(() {
    getInventory = _GetInventory();
    findByBarcode = _FindByBarcode();
    linkBarcode = _LinkBarcode();
    when(() => getInventory(_biz)).thenAnswer((_) async => const Right([_rice, _beans, _zobo]));
  });

  ScanCubit build() =>
      ScanCubit(businessId: _biz, getInventory: getInventory, findByBarcode: findByBarcode, linkBarcode: linkBarcode);

  blocTest<ScanCubit, ScanState>(
    'prepare caches the inventory, then waits for a scan',
    build: build,
    act: (c) => c.prepare(),
    expect: () => [const ScanPreparing(), const ScanIdle()],
  );

  blocTest<ScanCubit, ScanState>(
    'a known barcode resolves on the device — no network call — even as 12-digit UPC-A',
    build: build,
    act: (c) async {
      await c.prepare();
      await c.scanned('036000291452');
    },
    skip: 2,
    expect: () => [const ScanFound(_rice, fromCache: true)],
    verify: (_) => verifyNever(() => findByBarcode(any())),
  );

  blocTest<ScanCubit, ScanState>(
    'a cache miss asks the API; a hit there is cached for next time',
    build: build,
    setUp: () =>
        when(() => findByBarcode(any())).thenAnswer((_) async => Right(_beans.copyWith(barcode: '6156000024013'))),
    act: (c) async {
      await c.prepare();
      await c.scanned('6156000024013');
      c.resume();
      await c.scanned('6156000024013');
    },
    skip: 2,
    expect: () => [
      const ScanLookingUp('6156000024013'),
      ScanFound(_beans.copyWith(barcode: '6156000024013'), fromCache: false),
      const ScanIdle(),
      ScanFound(_beans.copyWith(barcode: '6156000024013'), fromCache: true),
    ],
    verify: (_) => verify(() => findByBarcode(any())).called(1),
  );

  blocTest<ScanCubit, ScanState>(
    'an unknown barcode offers the items without a barcode, sorted by name',
    build: build,
    setUp: () => when(() => findByBarcode(any())).thenAnswer((_) async => const Left(NotFoundFailure('No item'))),
    act: (c) async {
      await c.prepare();
      await c.scanned('6156000024013');
    },
    skip: 2,
    expect: () => [
      const ScanLookingUp('6156000024013'),
      const ScanNotFound(barcode: '6156000024013', linkable: [_beans, _zobo]),
    ],
  );

  blocTest<ScanCubit, ScanState>(
    'linking caches the barcode, so the next scan is instant and the item is no longer linkable',
    build: build,
    setUp: () {
      when(() => findByBarcode(any())).thenAnswer((_) async => const Left(NotFoundFailure('No item')));
      when(() => linkBarcode(any())).thenAnswer((_) async => Right(_zobo.copyWith(barcode: '6156000024013')));
    },
    act: (c) async {
      await c.prepare();
      await c.scanned('6156000024013');
      await c.link('6156000024013', _zobo);
      c.resume();
      await c.scanned('6156000024013');
    },
    skip: 4,
    expect: () => [
      const ScanLinking('6156000024013'),
      ScanLinked(_zobo.copyWith(barcode: '6156000024013')),
      const ScanIdle(),
      ScanFound(_zobo.copyWith(barcode: '6156000024013'), fromCache: true),
    ],
  );

  blocTest<ScanCubit, ScanState>(
    'a link conflict surfaces the API message',
    build: build,
    setUp: () => when(
      () => linkBarcode(any()),
    ).thenAnswer((_) async => const Left(ConflictFailure('Barcode 6156000024013 is already linked to another item'))),
    act: (c) async {
      await c.prepare();
      await c.link('6156000024013', _zobo);
    },
    skip: 2,
    expect: () => [
      const ScanLinking('6156000024013'),
      const ScanError('Barcode 6156000024013 is already linked to another item', barcode: '6156000024013'),
    ],
  );

  blocTest<ScanCubit, ScanState>(
    'if the inventory cannot be cached, scanning still works through the API',
    build: build,
    setUp: () {
      when(() => getInventory(_biz)).thenAnswer((_) async => const Left(ServerFailure('Offline')));
      when(() => findByBarcode(any())).thenAnswer((_) async => const Right(_rice));
    },
    act: (c) async {
      await c.prepare();
      await c.scanned('0036000291452');
    },
    expect: () => [
      const ScanPreparing(),
      const ScanCacheError('Offline'),
      const ScanLookingUp('0036000291452'),
      const ScanFound(_rice, fromCache: false),
    ],
  );
}
