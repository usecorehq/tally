import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../domain/entities/business.dart';
import '../../domain/entities/business_vertical.dart';
import '../cubit/setup_business_cubit.dart';

/// The onboarding steps, as apps/mp's wizard (its Confirm step is the starter list's footer here).
const kSetupSteps = ['Your business', 'Starter items'];

/// Same glyph per business type as apps/mp (and Qorelly's /setup).
const _verticalIcons = <String, (IconData, IconData)>{
  'restaurant': (IconsFill.chef_hat, IconsOutline.chef_hat),
  'spa': (IconsFill.mirror, IconsOutline.mirror),
  'pharmacy': (IconsFill.pills, IconsOutline.pills),
  'retail': (IconsFill.shop, IconsOutline.shop),
  'hospitality': (IconsFill.buildings, IconsOutline.buildings),
  'rental': (IconsFill.delivery, IconsOutline.delivery),
  'services': (IconsFill.document, IconsOutline.document),
  'warehousing': (IconsFill.box, IconsOutline.box),
};

/// Step 1: name the business and pick its Qore Catalog type. [onCreated] takes
/// the new business to the next step.
class SetupBusinessPage extends StatelessWidget {
  const SetupBusinessPage({super.key, required this.onCreated});
  final ValueChanged<Business> onCreated;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<SetupBusinessCubit>()..load(),
      child: _SetupBusinessView(onCreated: onCreated),
    );
  }
}

class _SetupBusinessView extends StatefulWidget {
  const _SetupBusinessView({required this.onCreated});
  final ValueChanged<Business> onCreated;

  @override
  State<_SetupBusinessView> createState() => _SetupBusinessViewState();
}

class _SetupBusinessViewState extends State<_SetupBusinessView> {
  final _name = TextEditingController();

  /// Qorelly rule: Continue stays enabled; pressing it flags what's missing.
  bool _attempted = false;

  @override
  void initState() {
    super.initState();
    // Clear "Enter your business name" as soon as they type.
    _name.addListener(() {
      if (_attempted) setState(() {});
    });
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _submit(SetupBusinessState state) {
    setState(() => _attempted = true);
    if (_name.text.trim().isEmpty || state.subtypeCode.isEmpty) return;
    context.read<SetupBusinessCubit>().submit(_name.text);
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return BlocConsumer<SetupBusinessCubit, SetupBusinessState>(
      listenWhen: (a, b) => a.created == null && b.created != null,
      listener: (context, state) => widget.onCreated(state.created!),
      builder: (context, state) => Scaffold(
        backgroundColor: c.surface,
        body: SafeArea(
          child: Column(
            children: [
              const AuthStepStrip(labels: kSetupSteps, index: 0),
              Divider(height: 1, color: c.divider),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                  children: [
                    const AuthHeading(
                      title: 'Set up your business',
                      subtitle: 'Tell us what you sell and Tally will suggest your starter stock.',
                      start: true,
                    ),
                    const SizedBox(height: 24),
                    if (state.error != null) ...[AuthMessage(state.error!), const SizedBox(height: 16)],
                    AuthField(
                      label: 'Business name',
                      hint: 'e.g. Mama Nkechi Supermarket',
                      controller: _name,
                      icon: IconsOutline.shop,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.organizationName],
                    ),
                    if (_attempted && _name.text.trim().isEmpty) const _FieldError('Enter your business name.'),
                    const SizedBox(height: 24),
                    Text('Industry', style: V15.label.copyWith(color: c.gray900)),
                    const SizedBox(height: 8),
                    _Industries(state: state),
                    if (state.vertical case final v? when v.subtypes.length > 1) ...[
                      const SizedBox(height: 24),
                      Text('What kind of ${v.label.toLowerCase()}?', style: V15.label.copyWith(color: c.gray900)),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final s in v.subtypes)
                            _Choice(
                              label: s.label,
                              selected: s.code == state.subtypeCode,
                              onTap: () => context.read<SetupBusinessCubit>().pickSubtype(s.code),
                            ),
                        ],
                      ),
                    ],
                    if (_attempted && state.subtypeCode.isEmpty)
                      const _FieldError('Choose your industry and business type.'),
                  ],
                ),
              ),
              Divider(height: 1, color: c.divider),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  children: [
                    AuthTextAction(
                      'Sign out',
                      quiet: true,
                      onTap: () => context.read<AuthBloc>().add(const AuthSignOutRequested()),
                    ),
                    const Spacer(),
                    V15Button('Continue', height: 48, loading: state.submitting, onPressed: () => _submit(state)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The industry list: pending rows, a failed read with retry, or one row per type.
class _Industries extends StatelessWidget {
  const _Industries({required this.state});
  final SetupBusinessState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SetupBusinessCubit>();
    return V15Section(
      rows: switch (state.verticalsStatus) {
        VerticalsStatus.loading => const [V15SkeletonRows(count: 4)],
        VerticalsStatus.error => [
          V15ErrorRow(state.verticalsError ?? "Couldn't load business types.", onRetry: cubit.load),
        ],
        VerticalsStatus.ready => [
          for (final v in state.verticals)
            _IndustryRow(vertical: v, selected: v.code == state.verticalCode, onTap: () => cubit.pickVertical(v.code)),
        ],
      },
    );
  }
}

class _IndustryRow extends StatelessWidget {
  const _IndustryRow({required this.vertical, required this.selected, required this.onTap});
  final BusinessVertical vertical;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (fill, outline) = _verticalIcons[vertical.code] ?? (IconsFill.widget_5, IconsOutline.widget_5);
    return Semantics(
      selected: selected,
      child: Material(
        color: selected ? c.primaryLight : Colors.transparent,
        child: V15Row(
          onTap: onTap,
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: selected ? c.primary : c.gray100, shape: BoxShape.circle),
            child: Icon(selected ? fill : outline, size: 22, color: selected ? c.onPrimary : c.gray700),
          ),
          title: vertical.label,
          subtitle: vertical.description,
          trailing: selected ? Icon(IconsOutline.check_circle, size: 22, color: c.primary) : null,
        ),
      ),
    );
  }
}

/// A selectable 40-tall key (V2 chip): gray-100, the accent tint with an accent ring when picked.
class _Choice extends StatelessWidget {
  const _Choice({required this.label, required this.selected, required this.onTap});
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
          height: 40,
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

class _FieldError extends StatelessWidget {
  const _FieldError(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text(text, style: V15.text(13, FontWeight.w400, V15.of(context).redFg)),
  );
}
