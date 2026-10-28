import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/business/domain/entities/business.dart';
import 'package:qore_tally/features/business/domain/entities/business_draft.dart';
import 'package:qore_tally/features/business/domain/entities/starter_items.dart';
import 'package:qore_tally/features/business/domain/usecases/setup_usecases.dart';
import 'package:qore_tally/features/business/presentation/cubit/setup_business_cubit.dart';
import 'package:qore_tally/features/business/presentation/cubit/starter_items_cubit.dart';

class _GetRows extends Mock implements GetStarterRows {}

class _Create extends Mock implements CreateBusiness {}

class _Submit extends Mock implements SubmitStarterItems {}

class _GetVerticals extends Mock implements GetBusinessVerticals {}

const _draft = BusinessDraft(name: 'Mama Nkechi', subtypeCode: 'cafe');
const _business = Business(id: 'b1', name: 'Mama Nkechi', subtypeCode: 'cafe', role: 'owner');
const _row = StarterRow(key: 'cafe:coffee:0', groupLabel: 'Coffee', templateName: 'Espresso', candidates: []);
const _result = StarterResult(created: 0, skipped: 0, removed: 1, invalid: 0);

void main() {
  late _GetRows getRows;
  late _Create create;
  late _Submit submit;

  setUpAll(() {
    registerFallbackValue(_draft);
    registerFallbackValue(const SubmitStarterParams(businessId: '', rows: [], choices: {}));
  });

  setUp(() {
    getRows = _GetRows();
    create = _Create();
    submit = _Submit();
    when(() => getRows(any())).thenAnswer((_) async => const Right([_row]));
    when(() => create(any())).thenAnswer((_) async => const Right(_business));
  });

  StarterItemsCubit cubit() =>
      StarterItemsCubit(draft: _draft, getRows: getRows, createBusiness: create, submit: submit);

  test('nothing is created until Finish; a failed submit retried reuses the business', () async {
    final c = cubit();
    await c.load();
    verify(() => getRows('cafe')).called(1);
    verifyNever(() => create(any()));

    when(() => submit(any())).thenAnswer((_) async => const Left(ServerFailure('Network down')));
    await c.finish();
    expect(c.state.error, 'Network down');
    expect(c.state.business, _business);

    when(() => submit(any())).thenAnswer((_) async => const Right(_result));
    await c.finish();
    expect(c.state.step, StarterStep.done);
    verify(() => create(_draft)).called(1);
  });

  test('Skip creates the business only; a failed create says why and creates nothing', () async {
    when(() => create(any())).thenAnswer((_) async => const Left(ServerFailure('Network down')));
    final c = cubit();
    expect(await c.skip(), isFalse);
    expect(c.state.error, 'Network down');
    expect(c.state.business, isNull);

    when(() => create(any())).thenAnswer((_) async => const Right(_business));
    expect(await c.skip(), isTrue);
    verifyNever(() => submit(any()));
  });

  test('a renamed draft is what gets created', () async {
    const renamed = BusinessDraft(name: 'Nkechi Cafe', subtypeCode: 'cafe');
    final c = cubit()..rename(renamed);
    await c.skip();
    verify(() => create(renamed)).called(1);
  });

  test('step 1 hands on a draft without creating anything, or says what is missing', () {
    final s = SetupBusinessCubit(getVerticals: _GetVerticals())..submit('  ');
    expect(s.state.error, 'Enter your business name.');
    expect(s.state.draft, isNull);
    s
      ..pickSubtype('cafe')
      ..submit(' Mama Nkechi ');
    expect(s.state.draft, _draft);
    expect(s.state.error, isNull);
  });
}
