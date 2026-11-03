import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/design/v15_widgets.dart';
import 'package:qore_tally/features/stocktake/domain/entities/catalogue_product.dart';
import 'package:qore_tally/features/stocktake/domain/entities/photo_check.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';
import 'package:qore_tally/features/stocktake/domain/photo_quality.dart';
import 'package:qore_tally/features/stocktake/domain/scan_review.dart';
import 'package:qore_tally/features/stocktake/domain/usecases/catalogue_usecases.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/photo_check_cubit.dart';
import 'package:qore_tally/features/stocktake/presentation/cubit/product_picker_cubit.dart';
import 'package:qore_tally/features/stocktake/presentation/widgets/photo_check_panel.dart';
import 'package:qore_tally/features/stocktake/presentation/widgets/product_picker.dart';

class _Search extends Mock implements SearchCatalogue {}

class _Product extends Mock implements GetCatalogueProduct {}

const _line = ScanDetection(
  id: 'a',
  brand: 'Brand B',
  name: 'Snack',
  pack: '100g',
  look: 'yellow pouch',
  count: 4,
  candidates: [
    ScanCandidate(
      qid: 'QC-1',
      name: 'Brand B Snack 100g',
      score: 0.8,
      priceMedian: 900,
      match: MatchStrength.medium,
      size: ScanSize(100, 'g'),
    ),
  ],
);

Future<void> _pump(WidgetTester tester, ThemeData theme, Widget child) async {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: theme,
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  for (final (name, theme) in [('light', V15Theme.light()), ('dark', V15Theme.dark())]) {
    testWidgets('picker: suggestions, other sizes, search and new item ($name)', (tester) async {
      final search = _Search();
      final product = _Product();
      when(() => product('QC-1')).thenAnswer(
        (_) async => const Right(
          CatalogueProductDetail(
            qid: 'QC-1',
            name: 'Brand B Snack 100g',
            variants: [
              CatalogueVariant(qid: 'QC-1'),
              CatalogueVariant(qid: 'QC-2', variantLabel: '200g'),
            ],
          ),
        ),
      );
      when(() => search('snack')).thenAnswer((_) async => const Right([CatalogueProduct(qid: 'QC-3', name: 'Hit')]));
      final cubit = ProductPickerCubit(search: search, product: product, debounce: Duration.zero)..loadSizes('QC-1');
      await _pump(
        tester,
        theme,
        BlocProvider.value(
          value: cubit,
          child: ProductPickerSheet(d: _line, choice: ScanChoice.initial(_line), picked: _line.candidates.first),
        ),
      );
      await tester.pump();

      expect(find.text('SUGGESTED'), findsOneWidget);
      expect(find.text('~₦900'), findsOneWidget);
      expect(find.text('Medium match'), findsOneWidget);
      expect(find.text('200g'), findsOneWidget);
      expect(find.text('New item (not in catalogue)'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'snack');
      await tester.pump();
      await tester.pump();
      expect(find.text('Hit'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await cubit.close();
    });

    testWidgets('photo check panel states ($name)', (tester) async {
      Future<void> show(PhotoCheckState s) => _pump(tester, theme, PhotoCheckPanel(state: s, onRetake: () {}));

      await show(const PhotoCheckState());
      expect(find.text('Checking the photo with Muse Spark…'), findsOneWidget);

      await show(const PhotoCheckState(done: true));
      expect(find.byType(Text), findsNothing);

      await show(const PhotoCheckState(local: LocalPhotoCheck(dark: true), done: true));
      expect(find.text('This photo looks too dark. A clearer photo reads more products.'), findsOneWidget);

      await show(
        const PhotoCheckState(
          local: LocalPhotoCheck(glare: true),
          result: PhotoCheck(
            verdict: PhotoVerdict.retake,
            issues: [PhotoIssue.tooFar],
            instruction: 'Step closer.',
            productsVisible: 30,
            labelsLegible: LabelsLegible.few,
          ),
          done: true,
        ),
      );
      expect(find.text('Retake recommended'), findsOneWidget);
      expect(find.text('too far · glare on labels'), findsOneWidget);
      expect(find.text('~30 products · labels few readable'), findsOneWidget);
      expect(find.text('Step closer.'), findsOneWidget);
      expect(find.text('Retake photo'), findsOneWidget);

      await show(
        const PhotoCheckState(
          result: PhotoCheck(verdict: PhotoVerdict.good, instruction: 'x'),
          done: true,
        ),
      );
      expect(find.text('Good photo'), findsOneWidget);
      expect(find.text('x'), findsNothing);
      expect(find.text('Retake photo'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
}
