import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/inventory/domain/entities/inventory_item.dart';
import 'package:qore_tally/features/inventory/domain/usecases/inventory_usecases.dart';
import 'package:qore_tally/features/inventory/presentation/cubit/inventory_list_cubit.dart';

class _GetInventory extends Mock implements GetInventory {}

const _biz = 'biz-1';
const _rice = InventoryItem(
  id: 'i1',
  name: 'Big Bull Rice 25kg',
  price: '49000.00',
  quantityOnHand: '12.000',
  reorderPoint: '5.000',
);
const _beans = InventoryItem(
  id: 'i2',
  name: 'Honey Beans 2kg',
  price: '2500.50',
  quantityOnHand: '3.000',
  reorderPoint: '5.000',
);
const _zobo = InventoryItem(id: 'i3', name: "Mama's Zobo 50cl", price: '300.00', quantityOnHand: '24.500');

void main() {
  late _GetInventory getInventory;

  setUp(() {
    getInventory = _GetInventory();
    when(() => getInventory(_biz)).thenAnswer((_) async => const Right([_rice, _beans, _zobo]));
  });

  InventoryListCubit build() => InventoryListCubit(businessId: _biz, getInventory: getInventory);

  blocTest<InventoryListCubit, InventoryListState>(
    'load shows skeletons, then the items',
    build: build,
    act: (c) => c.load(),
    expect: () => [const InventoryListLoading(), const InventoryListLoaded(items: [_rice, _beans, _zobo])],
  );

  blocTest<InventoryListCubit, InventoryListState>(
    'a failed read is an error, never an empty inventory',
    build: build,
    setUp: () => when(() => getInventory(_biz)).thenAnswer((_) async => const Left(ServerFailure('Network down'))),
    act: (c) => c.load(),
    expect: () => [const InventoryListLoading(), const InventoryListError('Network down')],
  );

  blocTest<InventoryListCubit, InventoryListState>(
    'a refresh keeps the list on screen instead of going back to skeletons',
    build: build,
    seed: () => const InventoryListLoaded(items: [_rice]),
    act: (c) => c.load(),
    expect: () => [const InventoryListLoaded(items: [_rice, _beans, _zobo])],
  );

  blocTest<InventoryListCubit, InventoryListState>(
    'search filters by name, ignoring case, and survives a reload',
    build: build,
    act: (c) async {
      await c.load();
      c.search('  BEANS ');
      await c.load();
    },
    verify: (c) {
      final s = c.state as InventoryListLoaded;
      expect(s.query, 'BEANS');
      expect(s.visible, [_beans]);
    },
  );

  group('InventoryListLoaded', () {
    const loaded = InventoryListLoaded(items: [_rice, _beans, _zobo]);

    test('counts low stock: at or below the reorder point, never without one', () {
      expect(_beans.isLowStock, isTrue);
      expect(_rice.isLowStock, isFalse);
      expect(_zobo.isLowStock, isFalse);
      expect(loaded.lowStockCount, 1);
    });

    test('sums units on hand without float noise', () {
      expect(loaded.unitsOnHand, '39.500');
      expect(const InventoryListLoaded(items: [_rice, _beans]).unitsOnHand, '15');
    });
  });
}
