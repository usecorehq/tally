import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../core/utils/naira.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/scan_review.dart';
import '../cubit/scan_review_cubit.dart';

// Shared by the review's list and one-by-one views: what a line says about
// itself (LineBadges) and how it's decided (LineEditor), on one cubit.

/// Store status, match confidence and the agent's flag.
class LineBadges extends StatelessWidget {
  const LineBadges({super.key, required this.d});
  final ScanDetection d;

  @override
  Widget build(BuildContext context) {
    final (status, tone) = storeStatus(d);
    return Wrap(
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
    );
  }
}

/// A line's decision: action keys, count, product and, when adding, name and
/// price. [actions] defaults to every action for the line; the one-by-one card
/// passes them without Skip (that's its own button).
class LineEditor extends StatefulWidget {
  const LineEditor({super.key, required this.d, required this.choice, required this.showProblems, this.actions});
  final ScanDetection d;
  final ScanChoice choice;
  final bool showProblems;
  final List<ScanAction>? actions;

  @override
  State<LineEditor> createState() => _LineEditorState();
}

class _LineEditorState extends State<LineEditor> {
  late final _quantity = TextEditingController(text: widget.choice.quantity);
  late final _name = TextEditingController(text: widget.choice.name);
  late final _price = TextEditingController(text: widget.choice.price);

  @override
  void didUpdateWidget(LineEditor old) {
    super.didUpdateWidget(old);
    // Picking a product renames the line and resets its price: show that.
    _sync(_name, widget.choice.name);
    _sync(_price, widget.choice.price);
    _sync(_quantity, widget.choice.quantity);
  }

  static void _sync(TextEditingController t, String value) {
    if (t.text == value) return;
    t.value = TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
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
    final picked = d.candidates.where((x) => x.qid == choice.choice).firstOrNull;
    final actions = widget.actions ?? actionsFor(d);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (actions.length > 1)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final a in actions)
                  ActionKey(
                    label: kScanActionLabels[a]!,
                    selected: a == choice.action,
                    onTap: () => cubit.setAction(d.id, a),
                  ),
              ],
            ),
          ),
        if (!skipped) ...[
          CountStepper(
            controller: _quantity,
            invalid: problems.quantity,
            onChanged: (v) => cubit.setQuantity(d.id, v),
            onStep: _step,
          ),
          if (productEditable(d, choice)) ...[
            const SizedBox(height: 8),
            ProductKey(d: d, choice: choice, onChoose: (qid) => cubit.choose(d.id, qid)),
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
                  child: ReviewField(
                    label: 'Item name',
                    controller: _name,
                    invalid: problems.name,
                    onChanged: (v) => cubit.setName(d.id, v),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ReviewField(
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
    );
  }
}

/// A selectable 36-tall key (V2 chip), as onboarding's sub-type keys.
class ActionKey extends StatelessWidget {
  const ActionKey({super.key, required this.label, required this.selected, required this.onTap});
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
class CountStepper extends StatelessWidget {
  const CountStepper({
    super.key,
    required this.controller,
    required this.invalid,
    required this.onChanged,
    required this.onStep,
  });
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

class ReviewField extends StatelessWidget {
  const ReviewField({
    super.key,
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
class ProductKey extends StatelessWidget {
  const ProductKey({super.key, required this.d, required this.choice, required this.onChoose});
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
