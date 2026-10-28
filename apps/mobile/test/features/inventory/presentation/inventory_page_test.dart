import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/design/v15_widgets.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/business/domain/entities/business.dart';
import 'package:qore_tally/features/inventory/domain/entities/inventory_item.dart';
import 'package:qore_tally/features/inventory/domain/usecases/inventory_usecases.dart';
import 'package:qore_tally/features/inventory/presentation/cubit/inventory_list_cubit.dart';
import 'package:qore_tally/features/inventory/presentation/pages/inventory_page.dart';
import 'package:qore_tally/injection_container.dart';

class _GetInventory extends Mock implements GetInventory {}

const _biz = Business(id: 'biz-1', name: 'Mama Put Provisions', subtypeCode: 'supermarket', role: 'owner');
const _beans = InventoryItem(
  id: 'i2',
  name: 'Honey Beans 2kg',
  price: '2500.50',
  quantityOnHand: '3.000',
  reorderPoint: '5.000',
);
const _zobo = InventoryItem(id: 'i3', name: "Mama's Zobo 50cl", price: '300.00', quantityOnHand: '24.000');

void main() {
  late _GetInventory getInventory;

  setUp(() {
    getInventory = _GetInventory();
    sl.registerFactoryParam<InventoryListCubit, String, void>(
      (businessId, _) => InventoryListCubit(businessId: businessId, getInventory: getInventory),
    );
  });

  tearDown(sl.reset);

  Future<void> pump(WidgetTester tester, ThemeData theme) async {
    // A small phone: 360 wide.
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(theme: theme, home: const Scaffold(body: InventoryPage(business: _biz))));
    await tester.pump();
  }

  for (final (name, theme) in [('light', V15Theme.light()), ('dark', V15Theme.dark())]) {
    testWidgets('loaded: rows, counts and the low-stock pill ($name)', (tester) async {
      when(() => getInventory(_biz.id)).thenAnswer((_) async => const Right([_beans, _zobo]));
      await pump(tester, theme);

      expect(find.text('Inventory'), findsOneWidget);
      expect(find.text('Scan a shelf'), findsOneWidget);
      expect(find.text('Honey Beans 2kg'), findsOneWidget);
      expect(find.text('₦2,500.50'), findsOneWidget);
      expect(find.text('Low'), findsOneWidget);
      expect(find.text('27'), findsOneWidget); // units on hand
      expect(tester.takeException(), isNull);
    });

    testWidgets('failed read: "–" figures and retry, never zeros ($name)', (tester) async {
      when(() => getInventory(_biz.id)).thenAnswer((_) async => const Left(ServerFailure('Network down')));
      await pump(tester, theme);

      expect(find.text(kV15NoFigure), findsNWidgets(3));
      expect(find.text('0'), findsNothing);
      expect(find.text('Network down'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('empty read: the no-items state', (tester) async {
    when(() => getInventory(_biz.id)).thenAnswer((_) async => const Right([]));
    await pump(tester, V15Theme.light());

    expect(find.text('No items yet'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
