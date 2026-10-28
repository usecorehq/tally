import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../../../../core/error/exceptions.dart';
import '../../domain/auth_rules.dart';
import '../models/merchant_user_model.dart';

abstract class AuthRemoteDataSource {
  Future<MerchantUserModel> signIn({required String email, required String password});
  Future<void> signOut();
  MerchantUserModel? currentUser();

  /// A new shared Qorelly account. Null when email confirmation is on (a code
  /// was sent); the signed-in user when the project returns a session.
  Future<MerchantUserModel?> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  });

  /// Confirm an emailed code. [recovery] signs in for a password reset;
  /// otherwise it confirms a sign-up. Either way a session starts.
  Future<MerchantUserModel> verifyEmailCode({required String email, required String code, required bool recovery});
  Future<void> resendSignupCode(String email);
  Future<void> requestPasswordReset(String email);
  Future<MerchantUserModel> updatePassword(String password);
}

/// Talks to the shared Qorelly Supabase Auth directly — the same accounts the
/// merchant portal signs in with. Mirrors qorelly-mobile's AuthService.
class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  const AuthRemoteDataSourceImpl(this._supabase);
  final sb.SupabaseClient _supabase;

  @override
  Future<MerchantUserModel> signIn({required String email, required String password}) =>
      _guard(() async {
        final res = await _supabase.auth.signInWithPassword(email: normalizeEmail(email), password: password);
        return _user(res.user);
      });

  @override
  Future<void> signOut() => _supabase.auth.signOut();

  @override
  MerchantUserModel? currentUser() {
    final user = _supabase.auth.currentUser;
    return user == null ? null : MerchantUserModel.fromSupabase(user);
  }

  @override
  Future<MerchantUserModel?> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) => _guard(() async {
    // Name, phone and role ride in user metadata: Qorelly's handle_new_user
    // trigger writes its own profile row from them. Tally writes nothing
    // outside the tally schema, so there is no profile upsert here.
    final res = await _supabase.auth.signUp(
      email: normalizeEmail(email),
      password: password,
      data: {'full_name': normalizeName(fullName), 'phone': ?phone, 'role': 'owner'},
    );
    // With confirmation on, GoTrue answers an already-registered email with a
    // stand-in user that has no identities (and sends no code).
    if (res.user?.identities?.isEmpty ?? false) {
      throw const AuthException('An account with this email already exists. Sign in instead.');
    }
    if (res.session == null) return null;
    return _user(res.user);
  });

  @override
  Future<MerchantUserModel> verifyEmailCode({required String email, required String code, required bool recovery}) =>
      _guard(() async {
        final res = await _supabase.auth.verifyOTP(
          email: normalizeEmail(email),
          token: normalizeOtp(code),
          type: recovery ? sb.OtpType.recovery : sb.OtpType.email,
        );
        return _user(res.user);
      });

  @override
  Future<void> resendSignupCode(String email) =>
      _guard(() => _supabase.auth.resend(type: sb.OtpType.signup, email: normalizeEmail(email)));

  @override
  Future<void> requestPasswordReset(String email) =>
      _guard(() => _supabase.auth.resetPasswordForEmail(normalizeEmail(email)));

  @override
  Future<MerchantUserModel> updatePassword(String password) => _guard(() async {
    final res = await _supabase.auth.updateUser(sb.UserAttributes(password: password));
    return _user(res.user);
  });

  MerchantUserModel _user(sb.User? user) {
    if (user == null) throw const AuthException('No user returned');
    return MerchantUserModel.fromSupabase(user);
  }

  /// GoTrue's errors as short, user-safe copy (qorelly-mobile's
  /// friendlyErrorMessage); never a URL or a class name.
  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on sb.AuthRetryableFetchException {
      throw const AuthException("You're offline. Check your connection and try again.");
    } on sb.AuthException catch (e) {
      final msg = e.message.toLowerCase();
      if (msg.contains('email not confirmed')) {
        throw const AuthException('Confirm your email to sign in.', emailNotConfirmed: true);
      }
      throw AuthException(switch (msg) {
        _ when msg.contains('invalid login credentials') => 'Wrong email or password.',
        _ when msg.contains('already registered') => 'An account with this email already exists. Sign in instead.',
        _ when msg.contains('expired') || msg.contains('invalid') && msg.contains('otp') =>
          'That code is wrong or has expired. Check the latest email or send a new code.',
        _ when msg.contains('same') && msg.contains('password') => 'Choose a password you haven\'t used before.',
        _ when msg.contains('rate limit') || e.statusCode == '429' =>
          'Too many attempts. Wait a minute and try again.',
        _ when msg.contains('password') => e.message,
        _ => 'Something went wrong. Please try again.',
      });
    }
  }
}
