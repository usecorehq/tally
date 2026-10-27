import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/pages/sign_in_page.dart';
import 'features/home/presentation/pages/home_page.dart';
import 'injection_container.dart';

class TallyApp extends StatelessWidget {
  const TallyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<AuthBloc>()..add(const AuthStarted()),
      child: MaterialApp(
        title: 'Tally',
        // Qorelly primary; Material 3 filled buttons are already pill-shaped.
        theme: ThemeData(colorSchemeSeed: const Color(0xFF7856FF), useMaterial3: true),
        home: BlocBuilder<AuthBloc, AuthState>(
          builder: (context, state) => switch (state) {
            AuthUnknown() => const Scaffold(body: Center(child: CircularProgressIndicator())),
            Authenticated(:final user) => HomePage(user: user),
            Unauthenticated() => const SignInPage(),
          },
        ),
      ),
    );
  }
}
