import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../core/utils/naira.dart';
import '../../../../injection_container.dart';
import '../../../business/domain/entities/business.dart';
import '../../domain/entities/inventory_item.dart';
import '../cubit/inventory_list_cubit.dart';
import 'scanner_page.dart';

/// The default tab: shelf capture on top, the business's stock below.
class InventoryPage extends StatelessWidget {
  const InventoryPage({super.key, required this.business});
  final Business business;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      // Keyed by business so switching business reloads.
      key: ValueKey(business.id),
      create: (_) => sl<InventoryListCubit>(param1: business.id)..load(),
      child: _InventoryView(business: business),
    );
  }
}

class _InventoryView extends StatelessWidget {
  const _InventoryView({required this.business});
  final Business business;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<InventoryListCubit>();
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: cubit.load,
        child: BlocBuilder<InventoryListCubit, InventoryListState>(
          builder: (context, state) => ListView(
            padding: EdgeInsets.only(bottom: V15.bottomPad(context)),
            children: [
              V15PageHeader(
                subtitle: business.name,
                title: 'Inventory',
                actions: [
                  V15IconButton(
                    IconsOutline.scanner,
                    tooltip: 'Scan barcode',
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ScannerPage(businessId: business.id, businessName: business.name),
                      ),
                    ),
                  ),
                ],
              ),
              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _CaptureCard()),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: V15Search('Search items', onChanged: cubit.search),
              ),
              Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: _Summary(state: state)),
              Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: _StockList(state: state)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Photo-to-inventory's entry point. Planned: the key is off until the scan
/// API ships (docs/prd-photo-to-inventory.md, slices 1–7).
class _CaptureCard extends StatelessWidget {
  const _CaptureCard();

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return V15Tray(
      child: V15Sheet(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const V15IconTile(IconsOutline.camera),
                const SizedBox(width: 12),
                Expanded(child: Text('Scan a shelf', style: V15.cardHeading.copyWith(color: c.gray900))),
                const V15Pill('Coming soon', tone: V15PillTone.violet),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Take one photo. Tally counts every product and matches it to Qore Catalog, then you confirm.',
              style: V15.description.copyWith(color: c.gray500),
            ),
            const SizedBox(height: 14),
            const V15Button('Scan shelf', icon: IconsOutline.camera, expand: true),
          ],
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.state});
  final InventoryListState state;

  @override
  Widget build(BuildContext context) {
    // Pending: skeleton figures. Failed: "–", never 0.
    final (items, units, low) = switch (state) {
      InventoryListLoading() => (null, null, null),
      InventoryListError() => (kV15NoFigure, kV15NoFigure, kV15NoFigure),
      InventoryListLoaded(:final items, :final unitsOnHand, :final lowStockCount) => (
        '${items.length}',
        formatQuantity(unitsOnHand),
        '$lowStockCount',
      ),
    };
    final s = state;
    final warnLow = s is InventoryListLoaded && s.lowStockCount > 0;
    return Row(
      children: [
        Expanded(child: V15Tile(label: 'Items', value: items)),
        const SizedBox(width: 12),
        Expanded(child: V15Tile(label: 'Units', value: units)),
        const SizedBox(width: 12),
        Expanded(child: V15Tile(label: 'Low stock', value: low, warn: warnLow)),
      ],
    );
  }
}

class _StockList extends StatelessWidget {
  const _StockList({required this.state});
  final InventoryListState state;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return switch (state) {
      InventoryListLoading() => const V15Section(title: 'Stock', rows: [V15SkeletonRows()]),
      InventoryListError(:final message) => V15Section(
        title: 'Stock',
        rows: [V15ErrorRow(message, onRetry: context.read<InventoryListCubit>().load)],
      ),
      final InventoryListLoaded s when s.items.isEmpty => const V15Section(
        title: 'Stock',
        rows: [
          V15MessageState(
            icon: IconsOutline.box,
            title: 'No items yet',
            body: 'Add your starter inventory in the Tally web app, or scan a shelf once photo scanning is live.',
          ),
        ],
      ),
      final InventoryListLoaded s when s.visible.isEmpty => V15Section(
        title: 'Stock',
        rows: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'No items match “${s.query}”',
              style: V15.ui.copyWith(color: c.gray400, fontWeight: FontWeight.w400),
            ),
          ),
        ],
      ),
      final InventoryListLoaded s => V15Section(
        title: 'Stock',
        count: s.visible.length,
        rows: [for (final item in s.visible) _ItemRow(item: item)],
      ),
    };
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item});
  final InventoryItem item;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return V15Row(
      leading: const V15IconTile(IconsOutline.box),
      title: item.name,
      subtitle: formatNaira(item.price),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(formatQuantity(item.quantityOnHand), style: V15.money.copyWith(color: c.gray900)),
          if (item.isLowStock) ...[const SizedBox(height: 4), const V15Pill('Low', tone: V15PillTone.amber)],
        ],
      ),
    );
  }
}
