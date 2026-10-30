import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/design/v15_widgets.dart';
import '../../../../../injection_container.dart';
import '../../../../business/domain/entities/business.dart';
import '../../../domain/usecases/stocktake_usecases.dart';
import '../../pages/scan_review_view.dart';
import '../../pages/shelf_scan_page.dart';
import '../../widgets/scan_photo.dart';
import '../cubit/session_cubit.dart';
import '../history_text.dart';
import '../widgets/discard_dialog.dart';
import '../widgets/finished_scan.dart';
import '../widgets/run_progress.dart';

/// One stock-take session from history ([id]: a run id, else a quick scan's id): progress while the agent
/// runs, the review while the scan is open, a read-only record once it's finished.
class SessionPage extends StatelessWidget {
  const SessionPage({super.key, required this.business, required this.id});
  final Business business;
  final String id;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<SessionCubit>(param1: business.id, param2: id)..load(),
      child: _SessionView(business: business),
    );
  }
}

class _SessionView extends StatelessWidget {
  const _SessionView({required this.business});
  final Business business;

  /// A new stock-take on top; this session is re-read when it closes.
  Future<void> _takeNewStock(BuildContext context) async {
    final cubit = context.read<SessionCubit>();
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ShelfScanPage(business: business)));
    if (!cubit.isClosed) await cubit.load(quiet: true);
  }

  Future<void> _openRerun(BuildContext context, String runId) async {
    final cubit = context.read<SessionCubit>()..rerunOpened();
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SessionPage(business: business, id: runId),
      ),
    );
    // A rerun's confirm supersedes this one.
    if (!cubit.isClosed) await cubit.load(quiet: true);
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final load = sl<DownloadPhoto>().call;
    return BlocConsumer<SessionCubit, SessionState>(
      listenWhen: (a, b) => b is SessionScan && b.rerunRunId != null && (a is! SessionScan || a.rerunRunId == null),
      listener: (context, state) => _openRerun(context, (state as SessionScan).rerunRunId!),
      builder: (context, state) {
        final cubit = context.read<SessionCubit>();
        if (state case SessionScan(:final scan) when !scan.readOnly) {
          return _OpenScanReview(
            business: business,
            state: state,
            onTakeNewStock: () => _takeNewStock(context),
            actions: _ScanActions(state: state),
          );
        }
        final (title, body, footer) = switch (state) {
          SessionLoading() => ('Stock-take', const _Loading(), null),
          SessionLoadFailed(:final message, :final missing) => (
            'Stock-take',
            missing
                ? const V15MessageState(
                    icon: IconsOutline.history,
                    title: "We couldn't find this stock-take",
                    body: 'It may belong to another of your businesses. Find it in the history.',
                  )
                : V15MessageState(
                    icon: IconsOutline.danger_circle,
                    title: "We couldn't open this stock-take",
                    body: message,
                    action: V15Button('Retry', tone: V15Tone.quiet, onPressed: cubit.load),
                  ),
            null,
          ),
          SessionRunning(lostTrack: final lost?) => (
            'Stock-take in progress',
            V15MessageState(
              icon: IconsOutline.danger_circle,
              title: 'We lost track of this stock-take',
              body: '${sentence(lost)} It keeps running on our side; try again to pick it back up.',
              action: V15Button('Retry', tone: V15Tone.quiet, onPressed: cubit.retryPolling),
            ),
            null,
          ),
          SessionRunning(:final run) => (
            'Stock-take in progress',
            RunProgress(run: run, businessName: business.name, load: load),
            null,
          ),
          SessionRunFailed(:final run) => (
            'Stock-take failed',
            V15MessageState(
              icon: IconsOutline.danger_circle,
              title: 'This stock-take stopped before it finished',
              body: '${sentence(run.error ?? 'Something went wrong on our side')} Nothing in your stock changed.',
              action: V15Button('Take new stock', icon: IconsOutline.gallery, onPressed: () => _takeNewStock(context)),
            ),
            null,
          ),
          SessionScan(:final scan, :final kind) => (
            'Stock-take',
            FinishedScan(scan: scan, kind: kind, businessName: business.name, load: load),
            _FinishedFooter(state: state, onTakeNewStock: () => _takeNewStock(context)),
          ),
        };
        return Scaffold(
          backgroundColor: c.surface,
          body: SafeArea(
            child: Column(
              children: [
                _Header(title: state is SessionScan ? '' : title, subtitle: business.name),
                Expanded(child: body),
                if (footer != null) ...[Divider(height: 1, color: c.divider), footer],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          V15IconButton(
            IconsOutline.alt_arrow_left,
            tooltip: 'History',
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title.isNotEmpty)
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: V15.sectionTitle.copyWith(color: c.gray900),
                  ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: V15.caption.copyWith(color: c.gray500),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
    children: const [
      V15PulseSkeleton(width: 220, height: 28),
      SizedBox(height: 16),
      PhotoSkeleton(),
      SizedBox(height: 16),
      V15Section(rows: [V15SkeletonRows(count: 3)]),
    ],
  );
}

/// Rerun (while the photo is kept and nothing moved stock) and Take new stock, with a rerun's 409 inline.
class _FinishedFooter extends StatelessWidget {
  const _FinishedFooter({required this.state, required this.onTakeNewStock});
  final SessionScan state;
  final VoidCallback onTakeNewStock;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (state.error != null) ...[
            Text(state.error!, style: V15.description.copyWith(color: c.redFg)),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              if (state.scan.canRerun) ...[
                Expanded(
                  child: V15Button(
                    'Rerun',
                    icon: IconsOutline.refresh,
                    tone: V15Tone.soft,
                    height: 48,
                    expand: true,
                    loading: state.rerunning,
                    onPressed: context.read<SessionCubit>().rerun,
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                flex: 2,
                child: V15Button(
                  'Take new stock',
                  icon: IconsOutline.gallery,
                  height: 48,
                  expand: true,
                  onPressed: onTakeNewStock,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Rerun and Discard over an open scan's review.
class _ScanActions extends StatelessWidget {
  const _ScanActions({required this.state});
  final SessionScan state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SessionCubit>();
    // Icon keys: they share the review header with its title on a phone.
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (state.scan.canRerun) ...[
          state.rerunning
              ? const SizedBox(
                  width: 40,
                  height: 40,
                  child: Center(
                    child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                )
              : V15IconButton(IconsOutline.refresh, tooltip: 'Rerun', onPressed: cubit.rerun),
          const SizedBox(width: 8),
        ],
        V15IconButton(IconsOutline.trash, tooltip: 'Discard', onPressed: () => confirmDiscard(context, cubit.discard)),
      ],
    );
  }
}

class _OpenScanReview extends StatelessWidget {
  const _OpenScanReview({
    required this.business,
    required this.state,
    required this.onTakeNewStock,
    required this.actions,
  });
  final Business business;
  final SessionScan state;
  final VoidCallback onTakeNewStock;
  final Widget actions;

  @override
  Widget build(BuildContext context) {
    // Rerun and Discard live in the review's own header, so they go with it on the outcome.
    return ScanReviewView(
      key: ValueKey(state.scan.scanId),
      business: business,
      scan: state.scan,
      fallback: state.fallback,
      onRetake: onTakeNewStock,
      onBack: () => Navigator.of(context).maybePop(),
      headerActions: [actions],
      banner: state.error == null
          ? null
          : Text(state.error!, style: V15.description.copyWith(color: V15.of(context).redFg)),
    );
  }
}
