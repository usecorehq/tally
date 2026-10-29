import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../auth/domain/entities/merchant_user.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../business/domain/entities/business.dart';
import '../../../business/presentation/cubit/business_cubit.dart';

/// Business switcher, account and sign out.
class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.user, required this.businesses, required this.selected});
  final MerchantUser user;
  final List<Business> businesses;
  final Business selected;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: EdgeInsets.only(bottom: V15.bottomPad(context)),
        children: [
          const V15PageHeader(title: 'Settings'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: V15Section(
              title: businesses.length > 1 ? 'Businesses' : 'Business',
              rows: [
                for (final b in businesses)
                  V15Row(
                    title: b.name,
                    subtitle: b.role == 'owner' ? 'Owner' : 'Staff',
                    trailing: b.id == selected.id ? Icon(IconsOutline.check_circle, size: 20, color: c.primary) : null,
                    onTap: b.id == selected.id ? null : () => context.read<BusinessCubit>().select(b),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: V15Section(
              title: 'Account',
              rows: [V15Row(leading: const V15IconTile(IconsOutline.user), title: user.email ?? 'Signed in')],
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: V15Button(
              'Sign out',
              tone: V15Tone.quiet,
              icon: IconsOutline.logout,
              expand: true,
              onPressed: () => context.read<AuthBloc>().add(const AuthSignOutRequested()),
            ),
          ),
        ],
      ),
    );
  }
}
