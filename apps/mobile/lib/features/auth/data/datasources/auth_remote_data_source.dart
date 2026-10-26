import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../../../../core/error/exceptions.dart';
import '../models/merchant_user_model.dart';

abstract class AuthRemoteDataSource {
  Future<MerchantUserModel> signIn({required String email, required String password});
  Future<void> signOut();
  MerchantUserModel? currentUser();
}

/// Talks to the shared Qorelly Supabase Auth directly — the same accounts the
/// merchant portal signs in with.
class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  const AuthRemoteDataSourceImpl(this._supabase);
  final sb.SupabaseClient _supabase;

  @override
  Future<MerchantUserModel> signIn({required String email, required String password}) async {
    try {
      final res = await _supabase.auth.signInWithPassword(email: email, password: password);
      final user = res.user;
      if (user == null) throw const AuthException('No user returned');
      return MerchantUserModel.fromSupabase(user);
    } on sb.AuthException catch (e) {
      throw AuthException(e.message);
    }
  }

  @override
  Future<void> signOut() => _supabase.auth.signOut();

  @override
  MerchantUserModel? currentUser() {
    final user = _supabase.auth.currentUser;
    return user == null ? null : MerchantUserModel.fromSupabase(user);
  }
}
