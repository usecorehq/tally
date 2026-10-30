import 'package:flutter/material.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../auth/domain/entities/merchant_user.dart';
import '../../../business/domain/entities/business.dart';
import '../../../inventory/presentation/pages/inventory_page.dart';
import 'scans_page.dart';
import 'settings_page.dart';

/// The three tabs. Inventory is the default.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.user, required this.businesses, required this.selected});
  final MerchantUser user;
  final List<Business> businesses;
  final Business selected;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _tabs = [
    (IconsFill.box, IconsOutline.box, 'Inventory'),
    (IconsFill.history, IconsOutline.history, 'Scans'),
    (IconsFill.settings, IconsOutline.settings, 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Rows scroll under the floating tab bar; pages pad by V15.bottomPad.
      extendBody: true,
      body: IndexedStack(
        index: _index,
        children: [
          InventoryPage(business: widget.selected),
          ScansPage(business: widget.selected, active: _index == 1),
          SettingsPage(user: widget.user, businesses: widget.businesses, selected: widget.selected),
        ],
      ),
      bottomNavigationBar: V15TabBar(items: _tabs, index: _index, onTap: (i) => setState(() => _index = i)),
    );
  }
}
