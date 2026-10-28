import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/auth/domain/auth_rules.dart';
import 'package:qore_tally/features/auth/domain/entities/merchant_user.dart';
import 'package:qore_tally/features/auth/domain/phone.dart';
import 'package:qore_tally/features/auth/domain/repositories/auth_repository.dart';
import 'package:qore_tally/features/auth/domain/usecases/account_usecases.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late _MockAuthRepository repository;

  setUp(() => repository = _MockAuthRepository());

  const user = MerchantUser(id: 'u1', email: 'ada@shop.ng');

  group('SignUp', () {
    SignUpParams params({String name = 'Ada  Obi', String email = ' Ada@Shop.NG ', String phone = '0803 123 4567'}) =>
        SignUpParams(fullName: name, email: email, phone: phone, password: 'secret1');

    test('sends the normalised email, name and E.164 phone; null means a code was emailed', () async {
      when(
        () => repository.signUp(email: 'ada@shop.ng', password: 'secret1', fullName: 'Ada Obi', phone: '+2348031234567'),
      ).thenAnswer((_) async => const Right(null));

      expect(await SignUp(repository)(params()), const Right<Failure, MerchantUser?>(null));
    });

    test("breaks Qorelly's rules before any round trip", () async {
      expect(await SignUp(repository)(params(name: '  ')), const Left<Failure, MerchantUser?>(AuthFailure(kNameRequiredError)));
      expect(
        await SignUp(repository)(params(email: 'you@mailinator.com')),
        const Left<Failure, MerchantUser?>(AuthFailure(kDisposableEmailError)),
      );
      expect(await SignUp(repository)(params(phone: '123')), const Left<Failure, MerchantUser?>(AuthFailure(kPhoneShapeError)));
      verifyNever(
        () => repository.signUp(
          email: any(named: 'email'),
          password: any(named: 'password'),
          fullName: any(named: 'fullName'),
          phone: any(named: 'phone'),
        ),
      );
    });
  });

  group('VerifyEmailCode', () {
    test('strips spaces from the code', () async {
      when(
        () => repository.verifyEmailCode(email: 'ada@shop.ng', code: '123456', recovery: false),
      ).thenAnswer((_) async => const Right(user));

      final result = await VerifyEmailCode(repository)(
        const VerifyCodeParams(email: 'ada@shop.ng', code: '123 456', recovery: false),
      );
      expect(result, const Right<Failure, MerchantUser>(user));
    });

    test('a code that is too short never reaches GoTrue', () async {
      final result = await VerifyEmailCode(repository)(
        const VerifyCodeParams(email: 'ada@shop.ng', code: '12', recovery: true),
      );
      expect(result.isLeft(), isTrue);
    });
  });

  test('SetNewPassword enforces the minimum length', () async {
    expect(await SetNewPassword(repository)('abc'), const Left<Failure, MerchantUser>(AuthFailure(kPasswordTooShortError)));
  });

  test('signUpProblem: a blank phone asks for one, a bad one explains the shape', () {
    String? problem(String phone) => signUpProblem(name: 'Ada', email: 'ada@shop.ng', phone: phone, password: 'secret1');
    expect(problem(''), kPhoneRequiredError);
    expect(problem('0803'), kPhoneShapeError);
    expect(problem(kNigeria.example), isNull);
  });
}
