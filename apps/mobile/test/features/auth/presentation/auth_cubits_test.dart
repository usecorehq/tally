import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qore_tally/core/error/failures.dart';
import 'package:qore_tally/features/auth/domain/entities/merchant_user.dart';
import 'package:qore_tally/features/auth/domain/usecases/account_usecases.dart';
import 'package:qore_tally/features/auth/domain/usecases/sign_in.dart';
import 'package:qore_tally/features/auth/presentation/cubit/account_cubits.dart';
import 'package:qore_tally/features/auth/presentation/cubit/sign_in_cubit.dart';

class _SignIn extends Mock implements SignIn {}

class _Resend extends Mock implements ResendSignupCode {}

class _Verify extends Mock implements VerifyEmailCode {}

class _Reset extends Mock implements RequestPasswordReset {}

const _user = MerchantUser(id: 'u1', email: 'ada@shop.ng');
const _params = SignInParams(email: 'ada@shop.ng', password: 'pw');

void main() {
  late _SignIn signIn;
  late _Resend resend;
  late _Verify verifyCode;
  late _Reset reset;

  setUpAll(() {
    registerFallbackValue(_params);
    registerFallbackValue(const VerifyCodeParams(email: '', code: '', recovery: false));
  });

  setUp(() {
    signIn = _SignIn();
    resend = _Resend();
    verifyCode = _Verify();
    reset = _Reset();
    when(() => resend(any())).thenAnswer((_) async => const Right(unit));
    when(() => reset(any())).thenAnswer((_) async => const Right(unit));
  });

  group('SignInCubit', () {
    blocTest<SignInCubit, SignInState>(
      'an unconfirmed email sends a fresh code and asks for it',
      build: () => SignInCubit(signIn, resend),
      setUp: () => when(() => signIn(any())).thenAnswer((_) async => const Left(EmailNotConfirmedFailure('Confirm'))),
      act: (c) => c.submit(email: 'ada@shop.ng', password: 'pw'),
      expect: () => [
        const SignInState(status: SignInStatus.submitting),
        const SignInState(status: SignInStatus.unconfirmed, error: 'Confirm'),
      ],
      verify: (_) => verify(() => resend('ada@shop.ng')).called(1),
    );

    blocTest<SignInCubit, SignInState>(
      'a wrong password is a plain failure — no code is sent',
      build: () => SignInCubit(signIn, resend),
      setUp: () => when(() => signIn(any())).thenAnswer((_) async => const Left(AuthFailure('Wrong email or password.'))),
      act: (c) => c.submit(email: 'ada@shop.ng', password: 'pw'),
      expect: () => [
        const SignInState(status: SignInStatus.submitting),
        const SignInState(status: SignInStatus.failure, error: 'Wrong email or password.'),
      ],
      verify: (_) => verifyNever(() => resend(any())),
    );
  });

  group('VerifyCodeCubit', () {
    VerifyCodeCubit build({bool recovery = false}) => VerifyCodeCubit(
      email: 'ada@shop.ng',
      recovery: recovery,
      verify: verifyCode,
      resendSignup: resend,
      resendRecovery: reset,
    );

    blocTest<VerifyCodeCubit, AuthFormState>(
      'a right code signs in',
      build: build,
      setUp: () => when(() => verifyCode(any())).thenAnswer((_) async => const Right(_user)),
      act: (c) => c.verify('123456'),
      expect: () => [
        const AuthFormState(status: AuthFormStatus.submitting),
        const AuthFormState(status: AuthFormStatus.done, user: _user),
      ],
    );

    blocTest<VerifyCodeCubit, AuthFormState>(
      'resend on a password reset asks for another reset email, not a sign-up code',
      build: () => build(recovery: true),
      act: (c) => c.resend(),
      expect: () => [
        const AuthFormState(status: AuthFormStatus.submitting),
        const AuthFormState(notice: 'We sent a new code to ada@shop.ng.'),
      ],
      verify: (_) {
        verify(() => reset('ada@shop.ng')).called(1);
        verifyNever(() => resend(any()));
      },
    );
  });
}
