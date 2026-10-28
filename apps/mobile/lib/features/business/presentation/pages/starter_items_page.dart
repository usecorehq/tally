import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../core/utils/naira.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/business.dart';
import '../../domain/entities/starter_items.dart';
import '../cubit/starter_items_cubit.dart';
import 'setup_business_page.dart';

/// Onboarding step 2 (apps/mp's items wizard): pick, confirm, done. [onDone]
/// opens the app on the new business.
class StarterItemsPage extends StatelessWidget {
  const StarterItemsPage({super.key, required this.business, required this.onDone});
  final Business business;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<StarterItemsCubit>(param1: business)..load(),
      child: _StarterItemsView(business: business, onDone: onDone),
    );
  }
}

class _StarterItemsView extends StatelessWidget {
  const _StarterItemsView({required this.business, required this.onDone});
  final Business business;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return BlocBuilder<StarterItemsCubit, StarterItemsState>(
      builder: (context, state) {
        final cubit = context.read<StarterItemsCubit>();
        final (body, footer) = switch (state) {
          StarterItemsState(step: StarterStep.done, :final result?) => (
            _Done(business: business, result: result, onDone: onDone),
            null,
          ),
          StarterItemsState(loadStatus: StarterLoadStatus.loading) => (const _Loading(), null),
          StarterItemsState(loadStatus: StarterLoadStatus.error, :final error) => (
            V15MessageState(
              icon: IconsOutline.danger_circle,
              title: "Couldn't load starter items",
              body: error,
              action: V15Button('Try again', tone: V15Tone.quiet, onPressed: cubit.load),
            ),
            _Footer(secondary: AuthTextAction('Skip for now', quiet: true, onTap: onDone)),
          ),
          StarterItemsState(step: StarterStep.confirm) => (
            _Confirm(business: business, state: state),
            _Footer(
              secondary: V15Button(
                'Back',
                tone: V15Tone.soft,
                height: 48,
                onPressed: state.submitting ? null : cubit.back,
              ),
              primary: V15Button('Finish setup', height: 48, loading: state.submitting, onPressed: cubit.finish),
            ),
          ),
          _ => (
            _Pick(state: state),
            _Footer(
              secondary: AuthTextAction('Skip for now', quiet: true, onTap: onDone),
              primary: V15Button('Continue', height: 48, onPressed: cubit.next),
            ),
          ),
        };
        return Scaffold(
          backgroundColor: c.surface,
          body: SafeArea(
            child: Column(
              children: [
                AuthStepStrip(labels: kSetupSteps, index: state.step == StarterStep.pick ? 1 : 2),
                Divider(height: 1, color: c.divider),
                Expanded(child: body),
                ?footer,
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.secondary, this.primary});
  final Widget secondary;
  final Widget? primary;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Divider(height: 1, color: V15.of(context).divider),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(children: [secondary, const Spacer(), ?primary]),
      ),
    ],
  );
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
    children: const [
      AuthHeading(
        title: 'Pick your starter items',
        subtitle: 'Finding the products shops like yours stock, with typical prices…',
        start: true,
      ),
      SizedBox(height: 24),
      V15Section(rows: [V15SkeletonRows(count: 6)]),
    ],
  );
}

class _Pick extends StatelessWidget {
  const _Pick({required this.state});
  final StarterItemsState state;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final invalid = state.invalidKeys.length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
      children: [
        const AuthHeading(
          title: 'Pick your starter items',
          subtitle:
              'Products shops like yours usually stock, with typical Nigerian prices. Keep what you sell and set your own price.',
          start: true,
        ),
        const SizedBox(height: 16),
        if (state.attempted && invalid > 0) ...[
          AuthMessage('$invalid item${invalid == 1 ? ' needs' : 's need'} a price or name.'),
          const SizedBox(height: 12),
        ],
        Text(
          '${state.kept.length} of ${state.rows.length} kept',
          style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
        ),
        for (final (label, rows) in state.groups) ...[
          const SizedBox(height: 16),
          V15Section(
            title: label,
            rows: [
              for (final r in rows)
                _StarterRowTile(
                  key: ValueKey(r.key),
                  row: r,
                  choice: state.choices[r.key]!,
                  showProblems: state.attempted,
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StarterRowTile extends StatelessWidget {
  const _StarterRowTile({super.key, required this.row, required this.choice, required this.showProblems});
  final StarterRow row;
  final StarterChoice choice;
  final bool showProblems;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<StarterItemsCubit>();
    final problems = showProblems ? StarterProblems.of(choice) : const StarterProblems();
    final picked = pickedCandidate(row, choice);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      color: choice.keep ? Colors.transparent : c.gray50,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => cubit.setKeep(row.key, !choice.keep),
            child: Row(
              children: [
                _CheckBox(checked: choice.keep),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.templateName,
                        style: V15.cardHeading.copyWith(color: choice.keep ? c.gray900 : c.gray500),
                      ),
                      if (!choice.keep && row.suggested != null)
                        Text(
                          'e.g. ${row.suggested!.name}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: V15.text(13, FontWeight.w400, c.gray400),
                        ),
                    ],
                  ),
                ),
                if (choice.keep && picked != null && picked.qid == row.suggested?.qid)
                  const V15Pill('Suggested', tone: V15PillTone.violet),
              ],
            ),
          ),
          if (choice.keep) ...[
            const SizedBox(height: 12),
            _ProductKey(row: row, choice: choice, onChoose: (qid) => cubit.choose(row.key, qid)),
            if (choice.isOwn) ...[
              const SizedBox(height: 8),
              _SmallField(
                hint: 'Name, e.g. ${row.templateName}',
                initial: choice.ownName,
                invalid: problems.name,
                onChanged: (v) => cubit.setOwnName(row.key, v),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _SmallField(
                    label: 'Your price (₦)',
                    initial: choice.price,
                    numeric: true,
                    invalid: problems.price,
                    onChanged: (v) => cubit.setPrice(row.key, v),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SmallField(
                    label: 'In stock',
                    hint: '0',
                    initial: choice.opening,
                    numeric: true,
                    invalid: problems.opening,
                    onChanged: (v) => cubit.setOpening(row.key, v),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// The product picked for a row; opens a sheet of the candidates plus "My own product".
class _ProductKey extends StatelessWidget {
  const _ProductKey({required this.row, required this.choice, required this.onChoose});
  final StarterRow row;
  final StarterChoice choice;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final picked = pickedCandidate(row, choice);
    return Semantics(
      button: true,
      label: 'Product: ${picked?.name ?? 'my own product'}',
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
                  picked?.name ?? 'My own product',
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
      backgroundColor: c.surface,
      builder: (sheet) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(row.templateName, style: V15.dialogTitle.copyWith(color: c.gray900)),
            ),
            V15Section(
              rows: [
                for (final cand in row.candidates)
                  V15Row(
                    title: cand.name,
                    subtitle: cand.priceMedian == null ? null : 'Typical price ${formatNaira('${cand.priceMedian}')}',
                    trailing: cand.qid == choice.choice
                        ? Icon(IconsOutline.check_circle, size: 20, color: c.primary)
                        : null,
                    onTap: () => Navigator.of(sheet).pop(cand.qid),
                  ),
                V15Row(
                  leading: const V15IconTile(IconsOutline.add_circle),
                  title: 'My own product',
                  trailing: choice.isOwn ? Icon(IconsOutline.check_circle, size: 20, color: c.primary) : null,
                  onTap: () => Navigator.of(sheet).pop(StarterChoice.own),
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

class _SmallField extends StatelessWidget {
  const _SmallField({
    this.label,
    this.hint,
    required this.initial,
    required this.onChanged,
    this.numeric = false,
    this.invalid = false,
  });
  final String? label;
  final String? hint;
  final String initial;
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
        if (label != null) ...[
          Text(label!, style: V15.text(12, FontWeight.w500, c.gray500)),
          const SizedBox(height: 4),
        ],
        TextFormField(
          initialValue: initial,
          onChanged: onChanged,
          keyboardType: numeric ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
          inputFormatters: numeric ? [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))] : null,
          textCapitalization: numeric ? TextCapitalization.none : TextCapitalization.words,
          style: V15.text(15, FontWeight.w400, c.gray900, tabular: numeric),
          decoration: InputDecoration(
            hintText: hint,
            isDense: true,
            enabledBorder: invalid
                ? OutlineInputBorder(
                    borderRadius: BorderRadius.circular(V15.sheetRadius),
                    borderSide: const BorderSide(color: Color(0xFFFCA5A5)),
                  )
                : null,
          ),
        ),
      ],
    );
  }
}

/// The V2 checkbox: gray-300 edge, filled with the accent when ticked.
class _CheckBox extends StatelessWidget {
  const _CheckBox({required this.checked});
  final bool checked;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Semantics(
      checked: checked,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        width: 22,
        height: 22,
        decoration: BoxDecoration(
          color: checked ? c.primary : c.surface,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: checked ? c.primary : c.gray300, width: 1.5),
        ),
        child: checked ? Icon(IconsOutline.check, size: 16, color: c.onPrimary) : null,
      ),
    );
  }
}

class _Confirm extends StatelessWidget {
  const _Confirm({required this.business, required this.state});
  final Business business;
  final StarterItemsState state;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final kept = state.kept;
    final skipped = state.rows.length - kept.length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
      children: [
        AuthHeading(
          title: 'Confirm your starter inventory',
          subtitle:
              '${kept.length} item${kept.length == 1 ? '' : 's'} for ${business.name}. You can change prices and stock any time.',
          start: true,
        ),
        const SizedBox(height: 16),
        if (state.error != null) ...[AuthMessage(state.error!), const SizedBox(height: 12)],
        if (kept.isEmpty)
          const AuthMessage(
            "You haven't kept any items. You can add products later, or go back and pick some.",
            tone: AuthTone.brand,
          )
        else
          V15Section(
            rows: [
              for (final r in kept)
                V15Row(
                  title: starterItemName(r, state.choices[r.key]!),
                  subtitle: r.templateName,
                  trailing: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        formatNaira(state.choices[r.key]!.price.trim()),
                        style: V15.money.copyWith(color: c.gray900),
                      ),
                      Text(
                        state.choices[r.key]!.opening.trim().isEmpty
                            ? 'No opening stock'
                            : '${state.choices[r.key]!.opening.trim()} in stock',
                        style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        const SizedBox(height: 12),
        Text(
          '$skipped item${skipped == 1 ? '' : 's'} skipped. Your choices help improve product suggestions for shops like yours.',
          style: V15.description.copyWith(color: c.gray500),
        ),
      ],
    );
  }
}

class _Done extends StatelessWidget {
  const _Done({required this.business, required this.result, required this.onDone});
  final Business business;
  final StarterResult result;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final added = result.added;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        V15MessageState(
          icon: IconsOutline.check_circle,
          title: '${business.name} is ready',
          body:
              '$added product${added == 1 ? '' : 's'} in your inventory'
              '${result.skipped > 0 ? ' (${result.skipped} already there)' : ''}.'
              '${result.invalid > 0 ? ' ${result.invalid} couldn\'t be added — add ${result.invalid == 1 ? 'it' : 'them'} from your inventory.' : ''}',
          action: V15Button('Go to inventory', height: 48, onPressed: onDone),
        ),
      ],
    );
  }
}
