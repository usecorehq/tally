import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../core/utils/naira.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/catalogue_product.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/scan_review.dart';
import '../cubit/product_picker_cubit.dart';

const kMatchPills = {
  MatchStrength.strong: ('Strong match', V15PillTone.green),
  MatchStrength.medium: ('Medium match', V15PillTone.amber),
  MatchStrength.low: ('Low match', V15PillTone.gray),
};

/// Opens the picker for line [d]; returns a suggestion's Qore ID or [ScanChoice.newItem] (a String), a
/// fetched [CatalogueProductDetail] (another size, a search hit), or null when dismissed.
Future<Object?> showProductPicker(
  BuildContext context, {
  required ScanDetection d,
  required ScanChoice choice,
  ScanCandidate? picked,
  Widget? thumb,
  ProductPickerCubit Function()? cubit,
}) {
  final c = V15.of(context);
  final current = choice.choice == null || choice.choice == ScanChoice.newItem ? null : choice.choice;
  return showModalBottomSheet<Object>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: c.surface,
    builder: (_) => BlocProvider(
      create: (_) => (cubit?.call() ?? sl<ProductPickerCubit>())..loadSizes(current),
      child: ProductPickerSheet(d: d, choice: choice, picked: picked, thumb: thumb),
    ),
  );
}

/// What a line is: its suggestions (with how well each fits), other sizes of the current pick (the most common
/// error is the right product in the wrong size), a catalogue search, or a new item. Picking anything closes it.
class ProductPickerSheet extends StatefulWidget {
  const ProductPickerSheet({super.key, required this.d, required this.choice, this.picked, this.thumb});
  final ScanDetection d;
  final ScanChoice choice;
  final ScanCandidate? picked;
  final Widget? thumb;

  @override
  State<ProductPickerSheet> createState() => _ProductPickerSheetState();
}

class _ProductPickerSheetState extends State<ProductPickerSheet> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _pickQid(String qid) async {
    final p = await context.read<ProductPickerCubit>().pick(qid);
    if (p != null && mounted) Navigator.of(context).pop(p);
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final d = widget.d;
    final current = widget.choice.choice;
    final currentQid = current == null || current == ScanChoice.newItem ? null : current;
    final reading = d.reading.isEmpty ? 'Unreadable label' : d.reading;
    final media = MediaQuery.of(context);
    return BlocBuilder<ProductPickerCubit, ProductPickerState>(
      builder: (context, s) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: media.size.height * 0.85),
        child: Padding(
          padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
              Text('Choose the product', style: V15.dialogTitle.copyWith(color: c.gray900)),
              const SizedBox(height: 2),
              Text(
                'Pick what this line is, so the catalogue learns it too.',
                style: V15.description.copyWith(color: c.gray500),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (widget.thumb != null) ...[
                    SizedBox(width: 56, height: 56, child: widget.thumb),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(reading, style: V15.cardHeading.copyWith(color: c.gray900)),
                        Text(
                          '${d.look.isEmpty ? '' : '${d.look} · '}counted ${d.count}',
                          style: V15.text(13, FontWeight.w400, c.gray500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (s.error != null) ...[AuthMessage(s.error!), const SizedBox(height: 12)],
              if (d.candidates.isNotEmpty)
                _Section(
                  title: 'Suggested',
                  children: [
                    for (final cand in d.candidates)
                      PickerOption(
                        selected: currentQid == cand.qid,
                        image: cand.image,
                        fallback: widget.thumb,
                        name: cand.label,
                        detail: sizeLabel(variantLabel: cand.variantLabel, size: cand.size, packQty: cand.packQty),
                        price: cand.priceMedian,
                        match: cand.match,
                        onTap: () => Navigator.of(context).pop(cand.qid),
                      ),
                  ],
                ),
              if (currentQid != null && (s.sizes?.isNotEmpty ?? false))
                _Section(
                  title: 'Other sizes',
                  hint: widget.picked?.label,
                  children: [
                    for (final v in s.sizes!)
                      PickerOption(
                        selected: false,
                        name: v.variantLabel ?? v.qid,
                        detail: v.variantLabel == null && v.packQty > 1 ? '× ${v.packQty}' : null,
                        busy: s.busy == v.qid,
                        onTap: () => _pickQid(v.qid),
                      ),
                  ],
                ),
              _Section(
                title: 'Search the catalogue',
                children: [
                  V15Search(
                    'Brand, product or size',
                    controller: _query,
                    onChanged: context.read<ProductPickerCubit>().query,
                  ),
                  if (s.searching)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: c.primary),
                          ),
                          const SizedBox(width: 8),
                          Text('Searching…', style: V15.text(13, FontWeight.w400, c.gray500)),
                        ],
                      ),
                    )
                  else if (s.hits != null && s.hits!.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
                      child: Text(
                        'Nothing in the catalogue for “${s.query}”.',
                        style: V15.text(13, FontWeight.w400, c.gray500),
                      ),
                    )
                  else
                    for (final h in s.hits ?? const <CatalogueProduct>[])
                      PickerOption(
                        selected: currentQid == h.qid,
                        image: h.image,
                        name: h.name,
                        detail: sizeLabel(variantLabel: h.variantLabel, size: h.size, packQty: h.packQty),
                        busy: s.busy == h.qid,
                        onTap: () => _pickQid(h.qid),
                      ),
                ],
              ),
              PickerOption(
                selected: current == ScanChoice.newItem,
                icon: IconsOutline.add_circle,
                name: 'New item (not in catalogue)',
                detail: 'Stock it as your own item: “$reading”',
                onTap: () => Navigator.of(context).pop(ScanChoice.newItem),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, this.hint, required this.children});
  final String title;
  final String? hint;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: title.toUpperCase()),
                  if (hint != null) TextSpan(text: ' · $hint', style: V15.text(12, FontWeight.w400, c.gray400)),
                ],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: V15.text(12, FontWeight.w500, c.gray500).copyWith(letterSpacing: 0.4),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

/// One choice: catalogue picture (else the line's own crop, else the box icon), name, size, typical price and
/// how well it matches.
class PickerOption extends StatelessWidget {
  const PickerOption({
    super.key,
    required this.selected,
    required this.name,
    required this.onTap,
    this.image,
    this.fallback,
    this.icon,
    this.detail,
    this.price,
    this.match,
    this.busy = false,
  });
  final bool selected;
  final String name;
  final VoidCallback onTap;
  final CatalogImage? image;
  final Widget? fallback;
  final IconData? icon;
  final String? detail;

  /// Whole Naira.
  final int? price;
  final MatchStrength? match;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final boxIcon = Icon(IconsOutline.box, size: 20, color: c.gray400);
    // Catalogue names usually carry the size already.
    final extra = detail != null && !name.contains(detail!) ? detail : null;
    final sub = [?extra, if (price != null) '~${formatNaira('$price')}'].join(' · ');
    final url = image?.url;
    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: busy ? null : onTap,
        child: Container(
          padding: const EdgeInsets.all(8),
          margin: const EdgeInsets.only(bottom: 4),
          decoration: BoxDecoration(
            color: selected ? c.primaryLight : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? c.primary : Colors.transparent),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 44,
                  height: 44,
                  color: c.gray100,
                  alignment: Alignment.center,
                  child: icon != null
                      ? Icon(icon, size: 20, color: c.gray600)
                      : url != null
                      ? Image.network(
                          url,
                          width: 44,
                          height: 44,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => fallback ?? boxIcon,
                        )
                      : fallback ?? boxIcon,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: V15.text(14, FontWeight.w500, c.gray900)),
                    if (sub.isNotEmpty) Text(sub, style: V15.text(13, FontWeight.w400, c.gray500, tabular: true)),
                  ],
                ),
              ),
              if (busy)
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: c.primary))
              else ...[
                if (match != null) ...[
                  const SizedBox(width: 8),
                  V15Pill(kMatchPills[match]!.$1, tone: kMatchPills[match]!.$2),
                ],
                if (selected) ...[
                  const SizedBox(width: 8),
                  Icon(IconsOutline.check_circle, size: 18, color: c.primary),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
