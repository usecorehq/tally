import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config/env.dart';
import 'core/network/api_client.dart';
import 'features/auth/data/datasources/auth_remote_data_source.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/account_usecases.dart';
import 'features/auth/domain/usecases/get_current_user.dart';
import 'features/auth/domain/usecases/sign_in.dart';
import 'features/auth/domain/usecases/sign_out.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/cubit/account_cubits.dart';
import 'features/auth/presentation/cubit/sign_in_cubit.dart';
import 'features/business/data/datasources/business_remote_data_source.dart';
import 'features/business/data/repositories/business_repository_impl.dart';
import 'features/business/domain/repositories/business_repository.dart';
import 'features/business/domain/usecases/get_my_businesses.dart';
import 'features/business/presentation/cubit/business_cubit.dart';
import 'features/inventory/data/datasources/inventory_remote_data_source.dart';
import 'features/inventory/data/repositories/inventory_repository_impl.dart';
import 'features/inventory/domain/repositories/inventory_repository.dart';
import 'features/inventory/domain/usecases/inventory_usecases.dart';
import 'features/inventory/presentation/cubit/inventory_list_cubit.dart';
import 'features/inventory/presentation/cubit/scan_cubit.dart';

final sl = GetIt.instance;

/// Register order: external → data sources → repositories → use cases → blocs.
/// Blocs/cubits are factories (fresh per page); everything else is a lazy singleton.
Future<void> initDependencies() async {
  // External
  await Supabase.initialize(url: Env.supabaseUrl, publishableKey: Env.supabasePublishableKey);
  sl.registerLazySingleton<SupabaseClient>(() => Supabase.instance.client);
  sl.registerLazySingleton<Dio>(() => buildApiClient(baseUrl: Env.apiBaseUrl, supabase: sl()));

  // Auth
  sl
    ..registerLazySingleton<AuthRemoteDataSource>(() => AuthRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl(sl()))
    ..registerLazySingleton(() => SignIn(sl()))
    ..registerLazySingleton(() => SignOut(sl()))
    ..registerLazySingleton(() => GetCurrentUser(sl()))
    ..registerLazySingleton(() => SignUp(sl()))
    ..registerLazySingleton(() => VerifyEmailCode(sl()))
    ..registerLazySingleton(() => ResendSignupCode(sl()))
    ..registerLazySingleton(() => RequestPasswordReset(sl()))
    ..registerLazySingleton(() => SetNewPassword(sl()))
    ..registerFactory(() => AuthBloc(getCurrentUser: sl(), signOut: sl()))
    ..registerFactory(() => SignInCubit(sl(), sl()))
    ..registerFactory(() => SignUpCubit(sl()))
    ..registerFactory(() => ForgotPasswordCubit(sl()))
    ..registerFactory(() => NewPasswordCubit(sl()))
    // The code screen is per email + flow: sl<VerifyCodeCubit>(param1: email, param2: recovery)
    ..registerFactoryParam<VerifyCodeCubit, String, bool>(
      (email, recovery) => VerifyCodeCubit(
        email: email,
        recovery: recovery,
        verify: sl(),
        resendSignup: sl(),
        resendRecovery: sl(),
      ),
    );

  // Business
  sl
    ..registerLazySingleton<BusinessRemoteDataSource>(() => BusinessRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<BusinessRepository>(() => BusinessRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetMyBusinesses(sl()))
    ..registerFactory(() => BusinessCubit(sl()));

  // Inventory (ScanCubit and InventoryListCubit are per business: sl<…>(param1: businessId))
  sl
    ..registerLazySingleton<InventoryRemoteDataSource>(() => InventoryRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<InventoryRepository>(() => InventoryRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetInventory(sl()))
    ..registerLazySingleton(() => FindByBarcode(sl()))
    ..registerLazySingleton(() => LinkBarcode(sl()))
    ..registerFactoryParam<ScanCubit, String, void>(
      (businessId, _) => ScanCubit(businessId: businessId, getInventory: sl(), findByBarcode: sl(), linkBarcode: sl()),
    )
    ..registerFactoryParam<InventoryListCubit, String, void>(
      (businessId, _) => InventoryListCubit(businessId: businessId, getInventory: sl()),
    );
}
