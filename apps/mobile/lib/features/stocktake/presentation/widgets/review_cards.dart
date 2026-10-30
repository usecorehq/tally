import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/scan_review.dart';
import '../cubit/scan_review_cubit.dart';
import 'review_parts.dart';
import 'scan_photo.dart';

/// The verb on a card's keep button, after its action (an earlier skip counts as the starting action).
String keepLabel(ScanDetection d, ScanChoice c) {
  final action = c.action == ScanAction.skip ? initialAction(d) : c.action;
  return switch (action) {
    ScanAction.restock => 'Restock',
    ScanAction.restore => 'Restore',
    ScanAction.add => 'Add',
    _ => 'Keep',
  };
}

/// One by one: a card per line — keep it (button or swipe right) or skip it
/// (button or swipe left) — then a summary to confirm. Same cubit and
/// decisions as the list, so switching views keeps every edit.
class ReviewCards extends StatelessWidget {
  const ReviewCards({super.key, required this.photo, required this.state});
  final ReviewImage photo;
  final ScanReviewState state;

  @override
  Widget build(BuildContext context) {
    final d = state.current;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Progress(state: state),
        const SizedBox(height: 12),
        if (d == null)
          _Summary(photo: photo, state: state)
        else
          _SwipeCard(
            // A new key per card, so a dismissed card never comes back as the next one.
            key: ValueKey('card-${d.id}-${state.cursor}'),
            d: d,
            choice: state.choices[d.id]!,
            photo: photo,
            flagged: state.flagged.contains(d.id),
          ),
      ],
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.state});
  final ScanReviewState state;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final total = state.rows.length;
    final done = state.cursor.clamp(0, total);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                done >= total ? 'All $total checked' : '${done + 1} of $total',
                style: V15.label.copyWith(color: c.gray900),
              ),
            ),
            if (done > 0)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: context.read<ScanReviewCubit>().previous,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(IconsOutline.alt_arrow_left, size: 16, color: c.gray600),
                      const SizedBox(width: 4),
                      Text('Previous', style: V15.ui.copyWith(color: c.gray600)),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: TweenAnimationBuilder<double>(
            tween: Tween(end: total == 0 ? 0 : done / total),
            duration: const Duration(milliseconds: 220),
            builder: (_, v, _) =>
                LinearProgressIndicator(value: v, minHeight: 4, color: c.primary, backgroundColor: c.gray100),
          ),
        ),
      ],
    );
  }
}

class _SwipeCard extends StatelessWidget {
  const _SwipeCard({super.key, required this.d, required this.choice, required this.photo, required this.flagged});
  final ScanDetection d;
  final ScanChoice choice;
  final ReviewImage photo;
  final bool flagged;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ScanReviewCubit>();
    final recount = d.countedBySam && d.samCount != d.sparkCount
        ? ' · counted ${d.samCount} (read ${d.sparkCount})'
        : '';
    Widget swipeLabel(String text, IconData icon, Color bg, Color fg, Alignment align) => Container(
      alignment: align,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(V15.trayRadius)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: fg, size: 22),
          const SizedBox(width: 8),
          Text(text, style: V15.cardHeading.copyWith(color: fg)),
        ],
      ),
    );
    return Dismissible(
      key: ValueKey('swipe-${d.id}'),
      // Right keeps (if nothing's missing, else the card springs back showing why), left skips.
      confirmDismiss: (dir) async => dir == DismissDirection.endToStart || cubit.canAcceptCurrent(),
      onDismissed: (dir) => dir == DismissDirection.startToEnd ? cubit.acceptCurrent() : cubit.skipCurrent(),
      background: swipeLabel(keepLabel(d, choice), IconsOutline.check, c.primary, c.onPrimary, Alignment.centerLeft),
      secondaryBackground: swipeLabel('Skip', IconsOutline.close_circle, c.gray200, c.gray900, Alignment.centerRight),
      child: V15Tray(
        child: V15Sheet(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: ScanThumb(
                  image: photo.image,
                  box: d.largestBox,
                  cropUrl: d.cropUrl,
                  loading: photo.loading,
                  size: 168,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                d.reading.isEmpty ? 'Unreadable label' : d.reading,
                textAlign: TextAlign.center,
                style: V15.sectionTitle.copyWith(color: c.gray900),
              ),
              const SizedBox(height: 2),
              Text(
                '${d.look.isEmpty ? '' : '${d.look} · '}${d.confidence.name} confidence$recount',
                textAlign: TextAlign.center,
                style: V15.text(13, FontWeight.w400, c.gray500),
              ),
              const SizedBox(height: 10),
              Center(child: LineBadges(d: d)),
              const SizedBox(height: 16),
              Divider(height: 1, color: c.divider),
              const SizedBox(height: 16),
              if (flagged && ScanProblems.of(choice).any && choice.action != null) ...[
                Text(
                  'Add a product, count, name or price to keep this one.',
                  style: V15.text(13, FontWeight.w500, c.redFg),
                ),
                const SizedBox(height: 10),
              ],
              LineEditor(
                d: d,
                choice: choice,
                showProblems: flagged,
                photo: photo,
                // Skip is the card's own button.
                actions: actionsFor(d).where((a) => a != ScanAction.skip).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Every line decided: what goes into stock, each line tappable to revisit.
class _Summary extends StatelessWidget {
  const _Summary({required this.photo, required this.state});
  final ReviewImage photo;
  final ScanReviewState state;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ScanReviewCubit>();
    final invalid = state.invalidIds.toSet();
    return V15Section(
      title: 'Ready to stock',
      rows: [
        for (final d in state.rows)
          Builder(
            builder: (context) {
              final choice = state.choices[d.id]!;
              final skipped = choice.action == ScanAction.skip;
              return V15Row(
                leading: ScanThumb(
                  image: photo.image,
                  box: d.largestBox,
                  cropUrl: d.cropUrl,
                  loading: photo.loading,
                  size: 40,
                ),
                title: d.reading.isEmpty ? 'Unreadable label' : d.reading,
                subtitle: choice.action == null
                    ? 'To choose'
                    : invalid.contains(d.id)
                    ? 'Needs a product, count, name or price'
                    : skipped
                    ? 'Skipped'
                    : '${kScanActionLabels[choice.action]} · ${choice.quantity.trim()} unit${choice.quantity.trim() == '1' ? '' : 's'}',
                trailing: Icon(
                  invalid.contains(d.id) ? IconsOutline.danger_circle : IconsOutline.alt_arrow_right,
                  size: 18,
                  color: invalid.contains(d.id) ? c.redFg : c.gray400,
                ),
                onTap: () => cubit.goTo(d.id),
              );
            },
          ),
      ],
    );
  }
}

/// The one-by-one footer: Skip and keep, or (all done) the confirm.
class ReviewCardsFooter extends StatelessWidget {
  const ReviewCardsFooter({super.key, required this.state, required this.confirm});
  final ScanReviewState state;

  /// The list's confirm button (same label and action).
  final Widget confirm;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ScanReviewCubit>();
    final d = state.current;
    if (d == null) return confirm;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: V15Button('Skip', tone: V15Tone.soft, height: 48, expand: true, onPressed: cubit.skipCurrent),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: V15Button(
                keepLabel(d, state.choices[d.id]!),
                icon: IconsOutline.check,
                height: 48,
                expand: true,
                onPressed: cubit.acceptCurrent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text('Swipe right to keep, left to skip', style: V15.text(12, FontWeight.w400, c.gray400)),
      ],
    );
  }
}
