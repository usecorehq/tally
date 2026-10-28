import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../auth/domain/entities/merchant_user.dart';
import '../../../business/presentation/cubit/business_cubit.dart';
import '../../../business/domain/entities/business_draft.dart';
import '../../../business/presentation/cubit/starter_items_cubit.dart';
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

/// Step 1 collects the name and type, step 2 picks the stock and creates the
/// business on Finish or Skip; then the app opens on it.
class _Onboarding extends StatefulWidget {
  const _Onboarding();

  @override
  State<_Onboarding> createState() => _OnboardingState();
}

class _OnboardingState extends State<_Onboarding> {
  BusinessDraft? _draft;
  bool _onStarter = false;

  /// Lives across Back so the picks are kept; a new type starts it over.
  StarterItemsCubit? _starter;

  void _continue(BusinessDraft draft) {
    final starter = _starter;
    if (starter != null && starter.state.draft.subtypeCode == draft.subtypeCode) {
      starter.rename(draft);
    } else {
      starter?.close();
      _starter = sl<StarterItemsCubit>(param1: draft)..load();
    }
    setState(() {
      _draft = draft;
      _onStarter = true;
    });
  }

  @override
  void dispose() {
    _starter?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final starter = _starter;
    if (starter == null || !_onStarter) {
      return SetupBusinessPage(initial: _draft, onContinue: _continue);
    }
    return StarterItemsPage(
      cubit: starter,
      onBack: () => setState(() => _onStarter = false),
      onDone: () => context.read<BusinessCubit>().load(),
    );
  }
}
