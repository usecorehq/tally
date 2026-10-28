import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../auth/domain/entities/merchant_user.dart';
import '../../../business/presentation/cubit/business_cubit.dart';
import '../../../business/domain/entities/business.dart';
import '../../../business/presentation/pages/setup_business_page.dart';
import '../../../business/presentation/pages/starter_items_page.dart';
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
          BusinessNone() => _BusinessGate(state: state),
          _ => Scaffold(
            body: SafeArea(child: _BusinessGate(state: state)),
          ),
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
      // No business yet: onboarding, as apps/mp's /onboarding.
      BusinessNone() => const _Onboarding(),
      _ => const Center(child: CircularProgressIndicator()),
    };
  }
}

/// Step 1 creates the business, step 2 stocks it; then the app opens on it.
class _Onboarding extends StatefulWidget {
  const _Onboarding();

  @override
  State<_Onboarding> createState() => _OnboardingState();
}

class _OnboardingState extends State<_Onboarding> {
  Business? _created;

  @override
  Widget build(BuildContext context) {
    final created = _created;
    if (created == null) return SetupBusinessPage(onCreated: (b) => setState(() => _created = b));
    return StarterItemsPage(business: created, onDone: () => context.read<BusinessCubit>().load());
  }
}
