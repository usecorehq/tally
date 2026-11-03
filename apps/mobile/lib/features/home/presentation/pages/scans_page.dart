import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../business/domain/entities/business.dart';
import '../../../stocktake/domain/entities/stocktake_history.dart';
import '../../../stocktake/presentation/history/cubit/history_cubit.dart';
import '../../../stocktake/presentation/history/pages/session_page.dart';
import '../../../stocktake/presentation/history/widgets/discard_dialog.dart';
import '../../../stocktake/presentation/history/widgets/history_list.dart';
import '../../../stocktake/presentation/pages/shelf_scan_page.dart';

/// The Scans tab: the business's stock-take history (apps/mp's /stocktake/history). [active] is whether
/// the tab is showing: polling pauses while it isn't, and the list re-reads when it comes back.
class ScansPage extends StatelessWidget {
  const ScansPage({super.key, required this.business, this.active = true});
  final Business business;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      // Keyed by business so switching business reloads.
      key: ValueKey(business.id),
      create: (_) => sl<HistoryCubit>(param1: business.id)..load(),
      child: _Active(
        active: active,
        child: _ScansView(business: business),
      ),
    );
  }
}

/// Tells the cubit when the tab is shown or hidden.
class _Active extends StatefulWidget {
  const _Active({required this.active, required this.child});
  final bool active;
  final Widget child;

  @override
  State<_Active> createState() => _ActiveState();
}

class _ActiveState extends State<_Active> {
  @override
  void initState() {
    super.initState();
    if (!widget.active) context.read<HistoryCubit>().setActive(false);
  }

  @override
  void didUpdateWidget(_Active old) {
    super.didUpdateWidget(old);
    if (old.active != widget.active) context.read<HistoryCubit>().setActive(widget.active);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _ScansView extends StatelessWidget {
  const _ScansView({required this.business});
  final Business business;

  /// Anything opened from here can confirm, rerun or discard: re-read on the way back.
  Future<void> _push(BuildContext context, Widget page) async {
    final cubit = context.read<HistoryCubit>();
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
    if (!cubit.isClosed) await cubit.refresh();
  }

  void _takeNewStock(BuildContext context) => _push(context, ShelfScanPage(business: business));

  void _open(BuildContext context, HistoryEntry e) => _push(context, SessionPage(business: business, id: e.id));

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<HistoryCubit>();
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: cubit.load,
        child: BlocBuilder<HistoryCubit, HistoryState>(
          builder: (context, state) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: V15.bottomPad(context)),
            children: [
              V15PageHeader(
                subtitle: business.name,
                title: 'Scans',
                actions: [
                  V15Button('Take new stock', icon: IconsOutline.gallery, onPressed: () => _takeNewStock(context)),
                ],
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: switch (state) {
                  HistoryLoading() => const HistorySkeleton(),
                  HistoryFailed(:final message) => V15Section(
                    title: "We couldn't load your stock-takes",
                    rows: [V15ErrorRow(message, onRetry: cubit.load)],
                  ),
                  HistoryLoaded(:final entries) when entries.isEmpty => V15Section(
                    rows: [
                      V15MessageState(
                        icon: IconsOutline.history,
                        title: 'No stock-takes yet',
                        body:
                            "Take a photo of a shelf and Tally counts and matches what's on it. Every stock-take is kept here.",
                        action: V15Button(
                          'Take new stock',
                          icon: IconsOutline.gallery,
                          onPressed: () => _takeNewStock(context),
                        ),
                      ),
                    ],
                  ),
                  final HistoryLoaded s => HistoryDays(
                    days: s.days,
                    onOpen: (e) => _open(context, e),
                    onDiscard: (scanId) => confirmDiscard(context, () => cubit.discard(scanId)),
                  ),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
