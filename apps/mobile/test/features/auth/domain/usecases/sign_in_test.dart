import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/auth/domain/entities/merchant_user.dart';
import 'package:qore_tally/features/auth/domain/repositories/auth_repository.dart';
import 'package:qore_tally/features/auth/domain/usecases/sign_in.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late _MockAuthRepository repository;
  late SignIn signIn;

  setUp(() {
    repository = _MockAuthRepository();
    signIn = SignIn(repository);
  });

  const user = MerchantUser(id: 'u1', email: 'ada@shop.ng');

  test('trims the email and returns the user on success', () async {
    when(() => repository.signIn(email: 'ada@shop.ng', password: 'pw'))
        .thenAnswer((_) async => const Right(user));

    final result = await signIn(const SignInParams(email: '  ada@shop.ng ', password: 'pw'));

    expect(result, const Right<Failure, MerchantUser>(user));
  });

  test('passes failures through', () async {
    when(() => repository.signIn(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => const Left(AuthFailure('Invalid login credentials')));

    final result = await signIn(const SignInParams(email: 'a@b.ng', password: 'x'));

    expect(result, const Left<Failure, MerchantUser>(AuthFailure('Invalid login credentials')));
  });
}
