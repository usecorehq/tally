import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../auth/domain/entities/merchant_user.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../business/presentation/cubit/business_cubit.dart';
import 'home_shell.dart';

/// Signed in: load the user's businesses, then the tab shell for the selected one.
class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.user});
  final MerchantUser user;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<BusinessCubit>()..load(),
      child: BlocBuilder<BusinessCubit, BusinessState>(
        builder: (context, state) => switch (state) {
          BusinessReady(:final businesses, :final selected) => HomeShell(
            user: user,
            businesses: businesses,
            selected: selected,
          ),
          _ => Scaffold(body: SafeArea(child: _BusinessGate(state: state))),
        },
      ),
    );
  }
}

class _BusinessGate extends StatelessWidget {
  const _BusinessGate({required this.state});
  final BusinessState state;

  @override
  Widget build(BuildContext context) {
    return switch (state) {
      // A failed read is an error with retry, never "no businesses".
      BusinessLoadError(:final message) => V15MessageState(
        icon: IconsOutline.danger_circle,
        title: "Couldn't load your businesses",
        body: message,
        action: V15Button('Try again', tone: V15Tone.quiet, onPressed: () => context.read<BusinessCubit>().load()),
      ),
      BusinessNone() => V15MessageState(
        icon: IconsOutline.box,
        title: 'Set up your business first',
        body: 'Create your business and starter inventory in the Tally web app, then come back here.',
        action: V15Button(
          'Sign out',
          tone: V15Tone.quiet,
          icon: IconsOutline.logout,
          onPressed: () => context.read<AuthBloc>().add(const AuthSignOutRequested()),
        ),
      ),
      _ => const Center(child: CircularProgressIndicator()),
    };
  }
}
