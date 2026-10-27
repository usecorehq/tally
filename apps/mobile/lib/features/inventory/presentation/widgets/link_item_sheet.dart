import 'package:flutter/material.dart';

import '../../../../core/utils/naira.dart';
import '../../domain/entities/inventory_item.dart';

/// Pick which of the business's items a new barcode belongs to. Returns null if dismissed.
Future<InventoryItem?> showLinkItemSheet(
  BuildContext context, {
  required List<InventoryItem> items,
  required String barcode,
}) {
  return showModalBottomSheet<InventoryItem>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _LinkItemSheet(items: items, barcode: barcode),
  );
}

class _LinkItemSheet extends StatefulWidget {
  const _LinkItemSheet({required this.items, required this.barcode});
  final List<InventoryItem> items;
  final String barcode;

  @override
  State<_LinkItemSheet> createState() => _LinkItemSheetState();
}

class _LinkItemSheetState extends State<_LinkItemSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final q = _query.trim().toLowerCase();
    final visible = q.isEmpty ? widget.items : widget.items.where((i) => i.name.toLowerCase().contains(q)).toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Link ${widget.barcode}',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text('Which item is this?', style: theme.textTheme.bodyMedium),
                const SizedBox(height: 12),
                TextField(
                  autofocus: false,
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search your items'),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ],
            ),
          ),
          Expanded(
            child: visible.isEmpty
                ? const Center(child: Text('No items match'))
                : ListView.separated(
                    controller: scroll,
                    itemCount: visible.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final item = visible[i];
                      return ListTile(
                        title: Text(item.name),
                        subtitle: Text('${formatNaira(item.price)} · ${formatQuantity(item.quantityOnHand)} in stock'),
                        onTap: () => Navigator.of(context).pop(item),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
