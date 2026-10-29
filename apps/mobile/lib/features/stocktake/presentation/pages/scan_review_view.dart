import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../business/domain/entities/business.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/scan_review.dart';
import '../../domain/usecases/stocktake_usecases.dart';
import '../cubit/scan_review_cubit.dart';
import '../widgets/review_cards.dart';
import '../widgets/review_parts.dart';
import '../widgets/scan_photo.dart';

/// S4 review → confirm → outcome, for one scan. Nothing is stocked until
/// Confirm; counts and matches are suggestions until then.
class ScanReviewView extends StatelessWidget {
  const ScanReviewView({
    super.key,
    required this.business,
    required this.photo,
    required this.scan,
    required this.fallback,
    required this.onRetake,
  });
  final Business business;
  final ShelfPhoto photo;
  final ShelfScan scan;
  final bool fallback;
  final VoidCallback onRetake;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ScanReviewCubit>(param1: business.id, param2: scan),
      child: DecodedPhoto(
        bytes: photo.bytes,
        builder: (context, image) => BlocBuilder<ScanReviewCubit, ScanReviewState>(
          builder: (context, state) => state.result == null
              ? _Review(business: business, image: image, state: state, fallback: fallback, onRetake: onRetake)
              : _Outcome(business: business, state: state, onRetake: onRetake),
        ),
      ),
    );
  }
}

class _Review extends StatelessWidget {
  const _Review({
    required this.business,
    required this.image,
    required this.state,
    required this.fallback,
    required this.onRetake,
  });
  final Business business;
  final ui.Image image;
  final ScanReviewState state;
  final bool fallback;
  final VoidCallback onRetake;

  Future<void> _retake(BuildContext context) async {
    final c = V15.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        backgroundColor: c.surface,
        title: Text('Take a new photo?', style: V15.dialogTitle.copyWith(color: c.gray900)),
        content: Text(
          "This scan's lines and your changes are dropped. Nothing has been stocked.",
          style: V15.description.copyWith(color: c.gray600),
        ),
        actions: [
          V15Button('Keep reviewing', tone: V15Tone.soft, onPressed: () => Navigator.of(dialog).pop(false)),
          V15Button('New photo', onPressed: () => Navigator.of(dialog).pop(true)),
        ],
      ),
    );
    if (ok == true) onRetake();
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ScanReviewCubit>();
    final rows = state.rows;
    final invalid = state.invalidIds.length;
    final counts = state.counts;
    final stocking = rows.length - counts[ScanAction.skip]!;
    final confirm = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${counts[ScanAction.restock]} restock · ${counts[ScanAction.restore]} restore · '
          '${counts[ScanAction.add]} add · ${counts[ScanAction.skip]} skip',
          style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
        ),
        const SizedBox(height: 8),
        V15Button(
          stocking == 0
              ? 'Confirm: nothing to stock'
              : 'Stock $stocking item${stocking == 1 ? '' : 's'}, ${state.units} unit${state.units == 1 ? '' : 's'}',
          height: 48,
          expand: true,
          loading: state.submitting,
          onPressed: rows.isEmpty ? null : cubit.submit,
        ),
      ],
    );
    return Scaffold(
      backgroundColor: c.surface,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
              child: Row(
                children: [
                  V15IconButton(IconsOutline.alt_arrow_left, tooltip: 'New photo', onPressed: () => _retake(context)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text('Check what we found', style: V15.sectionTitle.copyWith(color: c.gray900)),
                  ),
                ],
              ),
            ),
            if (rows.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: _ModeSwitch(mode: state.mode, onChanged: cubit.setMode),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                children: [
                  Text(
                    '${rows.length} product${rows.length == 1 ? '' : 's'} for ${business.name}. Fix counts and matches, then confirm.',
                    style: V15.description.copyWith(color: c.gray500),
                  ),
                  const SizedBox(height: 12),
                  if (fallback) ...[
                    const AuthMessage("The agent couldn't finish; showing the first pass.", tone: AuthTone.brand),
                    const SizedBox(height: 12),
                  ],
                  if (!state.scan.catalogueAvailable) ...[
                    const AuthMessage(
                      'The catalogue was unavailable, so there are no product matches. You can still add items by name.',
                      tone: AuthTone.brand,
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (state.attempted && invalid > 0) ...[
                    AuthMessage('$invalid line${invalid == 1 ? ' needs' : 's need'} a count, name or price.'),
                    const SizedBox(height: 12),
                  ],
                  if (state.error != null) ...[AuthMessage(state.error!), const SizedBox(height: 12)],
                  if (state.mode == ReviewMode.cards && rows.isNotEmpty)
                    ReviewCards(image: image, state: state)
                  else ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(V15.sheetRadius),
                      child: ScanPhotoView(
                        image: image,
                        detections: rows,
                        selected: state.selected,
                        onSelect: (id) => cubit.select(id == state.selected ? null : id),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text('Tap an outline to find its line.', style: V15.caption),
                    const SizedBox(height: 16),
                    if (rows.isEmpty)
                      const AuthMessage(
                        "We didn't find any products in this photo. Try a closer photo with the labels facing the camera.",
                        tone: AuthTone.brand,
                      )
                    else
                      V15Section(
                        rows: [
                          for (final d in rows)
                            _Line(
                              key: ValueKey(d.id),
                              d: d,
                              choice: state.choices[d.id]!,
                              image: image,
                              selected: d.id == state.selected,
                              showProblems: state.attempted,
                            ),
                        ],
                      ),
                  ],
                ],
              ),
            ),
            Divider(height: 1, color: c.divider),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: state.mode == ReviewMode.cards && rows.isNotEmpty
                  ? ReviewCardsFooter(state: state, confirm: confirm)
                  : confirm,
            ),
          ],
        ),
      ),
    );
  }
}

/// One detection: what was read, what the store already has, and the decision.
class _Line extends StatefulWidget {
  const _Line({
    super.key,
    required this.d,
    required this.choice,
    required this.image,
    required this.selected,
    required this.showProblems,
  });
  final ScanDetection d;
  final ScanChoice choice;
  final ui.Image image;
  final bool selected;
  final bool showProblems;

  @override
  State<_Line> createState() => _LineState();
}

class _LineState extends State<_Line> {
  @override
  void didUpdateWidget(_Line old) {
    super.didUpdateWidget(old);
    // Tapped on the photo: bring the line into view.
    if (widget.selected && !old.selected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Scrollable.ensureVisible(context, duration: const Duration(milliseconds: 250), alignment: 0.3);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ScanReviewCubit>();
    final d = widget.d;
    final skipped = widget.choice.action == ScanAction.skip;
    final recount = d.countedBySam && d.samCount != d.sparkCount
        ? ' · counted ${d.samCount} (read ${d.sparkCount})'
        : '';
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      color: widget.selected
          ? c.primaryLight
          : skipped
          ? c.gray50
          : Colors.transparent,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => cubit.select(widget.selected ? null : d.id),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ScanThumb(image: widget.image, box: d.largestBox),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        d.reading.isEmpty ? 'Unreadable label' : d.reading,
                        style: V15.cardHeading.copyWith(color: skipped ? c.gray500 : c.gray900),
                      ),
                      Text(
                        '${d.look.isEmpty ? '' : '${d.look} · '}${d.confidence.name} confidence$recount',
                        style: V15.text(13, FontWeight.w400, c.gray500),
                      ),
                      const SizedBox(height: 6),
                      LineBadges(d: d),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LineEditor(d: d, choice: widget.choice, showProblems: widget.showProblems),
        ],
      ),
    );
  }
}

class _Outcome extends StatelessWidget {
  const _Outcome({required this.business, required this.state, required this.onRetake});
  final Business business;
  final ScanReviewState state;
  final VoidCallback onRetake;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final r = state.result!;
    final byId = {for (final d in state.rows) d.id: d};
    final stats = [('Added', r.created), ('Restocked', r.restocked), ('Restored', r.restored), ('Skipped', r.skipped)];
    return Scaffold(
      backgroundColor: c.surface,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 40, 16, 24),
                children: [
                  Center(child: Icon(IconsOutline.check_circle, size: 48, color: c.primary)),
                  const SizedBox(height: 16),
                  Text(
                    'Stock updated',
                    textAlign: TextAlign.center,
                    style: V15.pageTitle.copyWith(color: c.gray900),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${business.name}'
                    '${r.alreadyDecided > 0 ? ' · ${r.alreadyDecided} line${r.alreadyDecided == 1 ? ' was' : 's were'} already confirmed' : ''}',
                    textAlign: TextAlign.center,
                    style: V15.description.copyWith(color: c.gray500),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      for (final (i, (label, n)) in stats.indexed) ...[
                        if (i > 0) const SizedBox(width: 8),
                        Expanded(
                          child: V15Tile(label: label, value: '$n'),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (r.invalid.isNotEmpty) ...[
                    AuthMessage(
                      '${r.invalid.length} line${r.invalid.length == 1 ? " wasn't" : "s weren't"} applied: '
                      '${r.invalid.map((i) => '${byId[i.$1]?.reading ?? 'a line'} (${i.$2})').join('; ')}',
                    ),
                    const SizedBox(height: 12),
                  ],
                  AuthMessage(
                    r.feedbackError != null
                        ? 'The catalogue was unreachable, so your corrections will be sent next time. Your stock is updated.'
                        : '${r.feedbackSent} line${r.feedbackSent == 1 ? '' : 's'} sent to Qore Catalog as feedback'
                              '${r.imagesUploaded > 0 ? ', with ${r.imagesUploaded} product photo${r.imagesUploaded == 1 ? '' : 's'}' : ''}. '
                              'Your corrections improve recognition for every shop.',
                    tone: AuthTone.brand,
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: c.divider),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: V15Button('Scan another', tone: V15Tone.soft, height: 48, expand: true, onPressed: onRetake),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: V15Button(
                      'Done',
                      height: 48,
                      expand: true,
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// List / One by one, at the top of the review. Both read and write the same decisions.
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({required this.mode, required this.onChanged});
  final ReviewMode mode;
  final ValueChanged<ReviewMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    Widget option(ReviewMode m, String label) {
      final on = m == mode;
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onChanged(m),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: on ? c.surface : Colors.transparent,
                borderRadius: BorderRadius.circular(10),
                boxShadow: on ? V15.sheetShadow : null,
              ),
              child: Text(label, style: V15.ui.copyWith(color: on ? c.gray900 : c.gray500)),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.gray100, borderRadius: BorderRadius.circular(kV15ButtonRadius)),
      child: Row(children: [option(ReviewMode.cards, 'One by one'), option(ReviewMode.list, 'List')]),
    );
  }
}
