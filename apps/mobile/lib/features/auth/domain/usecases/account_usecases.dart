import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../auth_rules.dart';
import '../entities/merchant_user.dart';
import '../phone.dart';
import '../repositories/auth_repository.dart';

/// Create a shared Qorelly account. `Right(null)`: a code was emailed.
/// Checks the same rules Qorelly does before the round trip; GoTrue stays the authority.
class SignUp implements UseCase<MerchantUser?, SignUpParams> {
  const SignUp(this._repository);
  final AuthRepository _repository;

  @override
  Future<Either<Failure, MerchantUser?>> call(SignUpParams p) async {
    final email = normalizeEmail(p.email);
    final name = normalizeName(p.fullName);
    final phone = normalizePhoneE164(p.phone);
    final invalid = signUpProblem(name: name, email: email, phone: p.phone, password: p.password);
    if (invalid != null) return Left(AuthFailure(invalid));
    return _repository.signUp(email: email, password: p.password, fullName: name, phone: phone);
  }
}

/// The first sign-up rule [name] … [password] break (Qorelly's copy), or null.
/// [email] and [name] are already normalised; [phone] is as typed.
String? signUpProblem({required String name, required String email, required String phone, required String password}) {
  if (name.isEmpty) return kNameRequiredError;
  if (!isValidEmailShape(email)) return kEmailShapeError;
  if (isDisposableEmail(email)) return kDisposableEmailError;
  if (phone.trim().isEmpty) return kPhoneRequiredError;
  if (!isValidPhone(phone)) return kPhoneShapeError;
  if (!isPasswordLongEnough(password)) return kPasswordTooShortError;
  return null;
}

class SignUpParams extends Equatable {
  const SignUpParams({required this.fullName, required this.email, required this.phone, required this.password});
  final String fullName;
  final String email;
  final String phone;
  final String password;

  @override
  List<Object?> get props => [fullName, email, phone, password];
}

class VerifyEmailCode implements UseCase<MerchantUser, VerifyCodeParams> {
  const VerifyEmailCode(this._repository);
  final AuthRepository _repository;

  @override
  Future<Either<Failure, MerchantUser>> call(VerifyCodeParams p) async {
    final code = normalizeOtp(p.code);
    if (!isPlausibleOtp(code)) return const Left(AuthFailure('Enter the code from the email.'));
    return _repository.verifyEmailCode(email: p.email, code: code, recovery: p.recovery);
  }
}

class VerifyCodeParams extends Equatable {
  const VerifyCodeParams({required this.email, required this.code, required this.recovery});
  final String email;
  final String code;
  final bool recovery;

  @override
  List<Object?> get props => [email, code, recovery];
}

class ResendSignupCode implements UseCase<Unit, String> {
  const ResendSignupCode(this._repository);
  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(String email) => _repository.resendSignupCode(email);
}

class RequestPasswordReset implements UseCase<Unit, String> {
  const RequestPasswordReset(this._repository);
  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(String email) async {
    final clean = normalizeEmail(email);
    if (!isValidEmailShape(clean)) return const Left(AuthFailure(kEmailShapeError));
    return _repository.requestPasswordReset(clean);
  }
}

class SetNewPassword implements UseCase<MerchantUser, String> {
  const SetNewPassword(this._repository);
  final AuthRepository _repository;

  @override
  Future<Either<Failure, MerchantUser>> call(String password) async {
    if (!isPasswordLongEnough(password)) return const Left(AuthFailure(kPasswordTooShortError));
    return _repository.updatePassword(password);
  }
}
