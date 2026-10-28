import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../core/utils/naira.dart';
import '../../../../injection_container.dart';
import '../../../business/domain/entities/business.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/scan_review.dart';
import '../../domain/usecases/stocktake_usecases.dart';
import '../cubit/scan_review_cubit.dart';
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
              ),
            ),
            Divider(height: 1, color: c.divider),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: Column(
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
              ),
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
  late final _quantity = TextEditingController(text: widget.choice.quantity);
  late final _name = TextEditingController(text: widget.choice.name);
  late final _price = TextEditingController(text: widget.choice.price);

  @override
  void didUpdateWidget(_Line old) {
    super.didUpdateWidget(old);
    // Picking a product renames the line and resets its price: show that.
    _sync(_name, widget.choice.name);
    _sync(_price, widget.choice.price);
    _sync(_quantity, widget.choice.quantity);
    // Tapped on the photo: bring the line into view.
    if (widget.selected && !old.selected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Scrollable.ensureVisible(context, duration: const Duration(milliseconds: 250), alignment: 0.3);
      });
    }
  }

  static void _sync(TextEditingController t, String value) {
    if (t.text == value) return;
    t.value = TextEditingValue(text: value, selection: TextSelection.collapsed(offset: value.length));
  }

  @override
  void dispose() {
    _quantity.dispose();
    _name.dispose();
    _price.dispose();
    super.dispose();
  }

  void _step(int by) {
    final now = int.tryParse(_quantity.text.trim()) ?? 0;
    final next = (now + by).clamp(0, 999999);
    context.read<ScanReviewCubit>().setQuantity(widget.d.id, '$next');
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ScanReviewCubit>();
    final d = widget.d;
    final choice = widget.choice;
    final skipped = choice.action == ScanAction.skip;
    final problems = widget.showProblems ? ScanProblems.of(choice) : const ScanProblems();
    final (status, tone) = storeStatus(d);
    final picked = d.candidates.where((x) => x.qid == choice.choice).firstOrNull;
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
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          V15Pill(
                            status,
                            tone: switch (tone) {
                              StoreTone.green => V15PillTone.green,
                              StoreTone.amber => V15PillTone.amber,
                              StoreTone.gray => V15PillTone.gray,
                            },
                          ),
                          V15Pill(
                            '${d.confidence.name[0].toUpperCase()}${d.confidence.name.substring(1)} match',
                            tone: switch (d.confidence) {
                              ScanConfidence.high => V15PillTone.green,
                              ScanConfidence.medium => V15PillTone.amber,
                              ScanConfidence.low => V15PillTone.red,
                            },
                          ),
                          if (d.review != null) V15Pill('Check: ${d.review}', tone: V15PillTone.amber),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final a in actionsFor(d))
                _ActionKey(
                  label: kScanActionLabels[a]!,
                  selected: a == choice.action,
                  onTap: () => cubit.setAction(d.id, a),
                ),
            ],
          ),
          if (!skipped) ...[
            const SizedBox(height: 12),
            _Stepper(
              controller: _quantity,
              invalid: problems.quantity,
              onChanged: (v) => cubit.setQuantity(d.id, v),
              onStep: _step,
            ),
            if (productEditable(d, choice)) ...[
              const SizedBox(height: 8),
              _ProductKey(d: d, choice: choice, onChoose: (qid) => cubit.choose(d.id, qid)),
              if (picked?.priceMedian != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Typical shelf price ${formatNaira('${picked!.priceMedian}')}'
                    '${picked.priceMin != null && picked.priceMax != null ? ' (${formatNaira('${picked.priceMin}')}–${formatNaira('${picked.priceMax}')})' : ''}',
                    style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
                  ),
                ),
            ],
            if (choice.action == ScanAction.add) ...[
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    flex: 3,
                    child: _Field(
                      label: 'Item name',
                      controller: _name,
                      invalid: problems.name,
                      onChanged: (v) => cubit.setName(d.id, v),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: _Field(
                      label: 'Your price (₦)',
                      controller: _price,
                      numeric: true,
                      invalid: problems.price,
                      onChanged: (v) => cubit.setPrice(d.id, v),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// A selectable 36-tall key (V2 chip), as onboarding's sub-type keys.
class _ActionKey extends StatelessWidget {
  const _ActionKey({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: selected ? c.primaryLight : c.gray100,
            borderRadius: BorderRadius.circular(kV15ButtonRadius),
            border: Border.all(color: selected ? c.primary : Colors.transparent),
          ),
          child: Center(
            widthFactor: 1,
            child: Text(label, style: V15.ui.copyWith(color: selected ? c.primaryInk : c.gray900)),
          ),
        ),
      ),
    );
  }
}

/// Count: − field +, whole units.
class _Stepper extends StatelessWidget {
  const _Stepper({required this.controller, required this.invalid, required this.onChanged, required this.onStep});
  final TextEditingController controller;
  final bool invalid;
  final ValueChanged<String> onChanged;
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    Widget key(String glyph, String label, int by) => Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(kV15ButtonRadius),
        onTap: () => onStep(by),
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: c.gray100, borderRadius: BorderRadius.circular(kV15ButtonRadius)),
          child: Text(glyph, style: V15.text(20, FontWeight.w500, c.gray900)),
        ),
      ),
    );
    return Row(
      children: [
        Text('Count', style: V15.label.copyWith(color: c.gray700)),
        const Spacer(),
        key('−', 'One fewer', -1),
        const SizedBox(width: 8),
        SizedBox(
          width: 72,
          child: TextField(
            controller: controller,
            onChanged: onChanged,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
            style: V15.text(16, FontWeight.w600, c.gray900, tabular: true),
            decoration: InputDecoration(isDense: true, enabledBorder: invalid ? _invalidBorder : null),
          ),
        ),
        const SizedBox(width: 8),
        key('+', 'One more', 1),
      ],
    );
  }
}

final _invalidBorder = OutlineInputBorder(
  borderRadius: BorderRadius.circular(V15.sheetRadius),
  borderSide: const BorderSide(color: Color(0xFFFCA5A5)),
);

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.onChanged,
    this.numeric = false,
    this.invalid = false,
  });
  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final bool numeric;
  final bool invalid;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: V15.text(12, FontWeight.w500, c.gray500)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          onChanged: onChanged,
          keyboardType: numeric ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
          inputFormatters: numeric ? [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))] : null,
          textCapitalization: numeric ? TextCapitalization.none : TextCapitalization.words,
          style: V15.text(15, FontWeight.w400, c.gray900, tabular: numeric),
          decoration: InputDecoration(isDense: true, enabledBorder: invalid ? _invalidBorder : null),
        ),
      ],
    );
  }
}

/// S5: the product for a line — the catalogue's plausible matches, or a new item.
class _ProductKey extends StatelessWidget {
  const _ProductKey({required this.d, required this.choice, required this.onChoose});
  final ScanDetection d;
  final ScanChoice choice;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final picked = d.candidates.where((x) => x.qid == choice.choice).firstOrNull;
    final label = picked?.label ?? (d.candidates.isEmpty ? 'New item (not in catalogue)' : 'None of these: new item');
    return Semantics(
      button: true,
      label: 'Product: $label',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(V15.sheetRadius),
        onTap: () => _pick(context),
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: c.gray50,
            borderRadius: BorderRadius.circular(V15.sheetRadius),
            border: Border.all(color: c.gray200),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: V15.text(15, FontWeight.w400, c.gray900),
                ),
              ),
              Icon(IconsOutline.alt_arrow_right, size: 16, color: c.gray400),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pick(BuildContext context) async {
    final c = V15.of(context);
    final qid = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: c.surface,
      builder: (sheet) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text(
              d.reading.isEmpty ? 'Which product is this?' : d.reading,
              style: V15.dialogTitle.copyWith(color: c.gray900),
            ),
            const SizedBox(height: 4),
            Text(
              d.candidates.isEmpty
                  ? 'Qore Catalog had no plausible match. Add it as your own item.'
                  : 'Plausible Qore Catalog matches, best first.',
              style: V15.description.copyWith(color: c.gray500),
            ),
            const SizedBox(height: 12),
            V15Section(
              rows: [
                for (final cand in d.candidates)
                  V15Row(
                    title: cand.label,
                    subtitle: [
                      if (cand.priceMedian != null) 'Typical ${formatNaira('${cand.priceMedian}')}',
                      if (cand.inventoryItemId != null) 'In your store',
                    ].join(' · '),
                    trailing: cand.qid == choice.choice
                        ? Icon(IconsOutline.check_circle, size: 20, color: c.primary)
                        : null,
                    onTap: () => Navigator.of(sheet).pop(cand.qid),
                  ),
                V15Row(
                  leading: const V15IconTile(IconsOutline.add_circle),
                  title: 'Add as my own item',
                  subtitle: 'Not in the catalogue',
                  trailing: choice.choice == ScanChoice.newItem
                      ? Icon(IconsOutline.check_circle, size: 20, color: c.primary)
                      : null,
                  onTap: () => Navigator.of(sheet).pop(ScanChoice.newItem),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (qid != null) onChoose(qid);
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
