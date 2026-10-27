import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../injection_container.dart';
import '../../../auth/domain/entities/merchant_user.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../business/domain/entities/business.dart';
import '../../../business/presentation/cubit/business_cubit.dart';
import '../../../inventory/presentation/pages/scanner_page.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.user});
  final MerchantUser user;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<BusinessCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Tally'),
          actions: [
            IconButton(
              tooltip: 'Sign out',
              icon: const Icon(Icons.logout),
              onPressed: () => context.read<AuthBloc>().add(const AuthSignOutRequested()),
            ),
          ],
        ),
        body: BlocBuilder<BusinessCubit, BusinessState>(
          builder: (context, state) => switch (state) {
            BusinessLoading() => const Center(child: CircularProgressIndicator()),
            // A failed read is an error with retry, never "no businesses".
            BusinessLoadError(:final message) => _Message(
              icon: Icons.cloud_off_outlined,
              title: "Couldn't load your businesses",
              body: message,
              action: FilledButton(
                onPressed: () => context.read<BusinessCubit>().load(),
                child: const Text('Try again'),
              ),
            ),
            BusinessNone() => const _Message(
              icon: Icons.storefront_outlined,
              title: 'Set up your business first',
              body: 'Create your business and starter inventory in the Tally web app, then come back here to scan.',
            ),
            BusinessReady(:final businesses, :final selected) => _Ready(
              user: user,
              businesses: businesses,
              selectedId: selected.id,
            ),
          },
        ),
      ),
    );
  }
}

class _Ready extends StatelessWidget {
  const _Ready({required this.user, required this.businesses, required this.selectedId});
  final MerchantUser user;
  final List<Business> businesses;
  final String selectedId;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<BusinessCubit>();
    final selected = businesses.firstWhere((b) => b.id == selectedId);
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(selected.name, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(user.email ?? '', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        if (businesses.length > 1) ...[
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: selectedId,
            decoration: const InputDecoration(labelText: 'Business'),
            items: [for (final b in businesses) DropdownMenuItem(value: b.id, child: Text(b.name))],
            onChanged: (id) => cubit.select(businesses.firstWhere((b) => b.id == id)),
          ),
        ],
        const SizedBox(height: 32),
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scan barcode'),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ScannerPage(businessId: selected.id, businessName: selected.name),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Point at a product to find it in your stock. Scan something new once to link it to an item.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.title, required this.body, this.action});
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}
