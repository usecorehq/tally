import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Dio for apps/api. Attaches the current Supabase access token as a Bearer
/// header — the API's SupabaseJwtGuard verifies it against the shared project.
Dio buildApiClient({required String baseUrl, required SupabaseClient supabase}) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
  ));
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) {
      final token = supabase.auth.currentSession?.accessToken;
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    },
  ));
  return dio;
}
