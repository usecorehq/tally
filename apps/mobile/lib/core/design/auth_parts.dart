import 'package:flutter/material.dart';

import 'v15_widgets.dart';

// Design 1.5 pieces for the way in — sign in, sign up, the code and reset
// screens, business setup. A subset of qorelly-mobile's
// lib/screens/auth/widgets/auth_v15_parts.dart with the same look; the mark
// is Tally's "T" (as apps/mp's onboarding shell) instead of the Qorelly logo.

/// Tally's mark: a "T" on the accent, 48 / 14px corners in the card, 36 in
/// a wizard's step strip.
class TallyMark extends StatelessWidget {
  final double size;
  const TallyMark({super.key, this.size = 48});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Semantics(
      label: 'Tally',
      image: true,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(size * 0.3)),
        child: Text('T', style: V15.text(size * 0.42, FontWeight.w600, c.onPrimary, height: 1)),
      ),
    );
  }
}

/// The page every auth screen sits on: a back key when there is somewhere
/// to go back to, then a centred, scrollable column (max 480).
class AuthScaffold extends StatelessWidget {
  final Widget child;
  const AuthScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      backgroundColor: c.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 52,
              child: canPop
                  ? Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: IconButton(
                        tooltip: 'Back',
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: Icon(IconsOutline.arrow_left, size: 22, color: c.gray900),
                      ),
                    )
                  : null,
            ),
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), child: child),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The card every auth form sits in (web AuthCard under V2): a gray-100 well,
/// 32px corners, 8px inset, around a raised white sheet (24px corners) that
/// holds the mark and the form. [footer] is the line on the well under it.
class AuthCard extends StatelessWidget {
  final List<Widget> children;
  final Widget? footer;
  const AuthCard({super.key, required this.children, this.footer});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Container(
      padding: const EdgeInsets.all(V15.trayLgInset),
      decoration: BoxDecoration(
        color: c.gray100,
        borderRadius: BorderRadius.circular(V15.trayLgRadius),
        border: Border.all(color: c.gray200.withValues(alpha: 0.8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(V15.sheetLgRadius),
              border: Border.all(color: c.hairline),
              boxShadow: const [
                BoxShadow(color: Color(0x1F000000), offset: Offset(0, 8), blurRadius: 24, spreadRadius: -8),
              ],
            ),
            child: Material(
              type: MaterialType.transparency,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Center(child: TallyMark()),
                  const SizedBox(height: 24),
                  ...children,
                ],
              ),
            ),
          ),
          if (footer != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
              child: Center(child: footer!),
            ),
        ],
      ),
    );
  }
}

/// An auth screen's title and the line under it: 28 semibold tight, centred;
/// 15 gray-500. [start] aligns them left (a wizard step).
class AuthHeading extends StatelessWidget {
  final String title;
  final String? subtitle;
  final bool start;
  const AuthHeading({super.key, required this.title, this.subtitle, this.start = false});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final align = start ? TextAlign.start : TextAlign.center;
    return Column(
      crossAxisAlignment: start ? CrossAxisAlignment.start : CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          textAlign: align,
          style: V15.text(start ? 24 : 28, FontWeight.w600, c.gray900, height: 1.15, tight: true),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(subtitle!, textAlign: align, style: V15.text(15, FontWeight.w400, c.gray500, height: 1.45)),
        ],
      ],
    );
  }
}

/// [AuthMessage] tones: error (red-50), success (green-50), brand (the accent's tint).
enum AuthTone { error, success, brand }

/// An inline message on a form: 14px corners, a 16 glyph, 13/20 text in the
/// tone's ink. Read as a live region.
class AuthMessage extends StatelessWidget {
  final String message;
  final AuthTone tone;
  const AuthMessage(this.message, {super.key, this.tone = AuthTone.error});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (Color bg, Color ink, Color glyph, IconData icon) = switch (tone) {
      AuthTone.error => (c.redBg, c.redInk, c.redFg, IconsOutline.danger_circle),
      AuthTone.success => (c.greenBg, c.greenFg, c.greenFg, IconsOutline.check_circle),
      AuthTone.brand => (c.primaryLight, c.gray900, c.primaryInk, IconsOutline.info_circle),
    };
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(V15.sheetRadius)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(icon, size: 16, color: glyph),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message, style: V15.text(13, FontWeight.w400, ink, height: 20 / 13)),
            ),
          ],
        ),
      ),
    );
  }
}

/// A text action (ghost, 14 medium) with a 44 hit area, in the accent's ink
/// (gray-500 when [quiet]). Fades when [onTap] is null.
class AuthTextAction extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool quiet;
  const AuthTextAction(this.label, {super.key, required this.onTap, this.quiet = false});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Center(
                widthFactor: 1,
                child: Text(label, style: V15.text(14, FontWeight.w500, quiet ? c.gray500 : c.primaryInk)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The line on the card's well: a 15 gray-500 prompt and the accent link.
class AuthFooterLine extends StatelessWidget {
  final String prompt;
  final String action;
  final VoidCallback onTap;
  const AuthFooterLine({super.key, required this.prompt, required this.action, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.center,
      children: [
        Text(prompt, style: V15.text(15, FontWeight.w400, c.gray500)),
        AuthTextAction(action, onTap: onTap),
      ],
    );
  }
}

/// The show / hide glyph in a password field: a bare 44 key, gray-400.
class AuthPasswordToggle extends StatelessWidget {
  final bool obscured;
  final VoidCallback onPressed;
  const AuthPasswordToggle({super.key, required this.obscured, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Semantics(
      button: true,
      label: obscured ? 'Show password' : 'Hide password',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(obscured ? IconsOutline.eye : IconsOutline.eye_closed, size: 18, color: c.gray400),
        ),
      ),
    );
  }
}

/// A labelled field: 13 medium label above the V2 field (the theme draws the
/// r14 gray-50 well), the error under it from [validator].
class AuthField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? hint;
  final IconData? icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool obscureText;
  final Widget? suffix;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onSubmitted;
  final TextCapitalization textCapitalization;
  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.icon,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.obscureText = false,
    this.suffix,
    this.validator,
    this.onSubmitted,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: V15.label.copyWith(color: c.gray900)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          obscureText: obscureText,
          validator: validator,
          onFieldSubmitted: onSubmitted,
          textCapitalization: textCapitalization,
          autocorrect: !obscureText && keyboardType != TextInputType.emailAddress,
          style: V15.text(16, FontWeight.w400, c.gray900),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: icon == null ? null : Icon(icon, size: 18, color: c.gray400),
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}

/// A wizard's step strip: the mark, "Step 2 of 3 · Details" and one 4px bar
/// per step — the accent up to here, gray-200 after.
class AuthStepStrip extends StatelessWidget {
  final List<String> labels;
  final int index;
  const AuthStepStrip({super.key, required this.labels, required this.index});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final shown = index.clamp(0, labels.length - 1);
    return Semantics(
      container: true,
      label: 'Step ${shown + 1} of ${labels.length}, ${labels[shown]}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(
          children: [
            const TallyMark(size: 36),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text.rich(
                    TextSpan(
                      text: 'Step ${shown + 1} of ${labels.length} · ',
                      children: [TextSpan(text: labels[shown], style: V15.text(13, FontWeight.w500, c.gray900))],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
                  ),
                  const SizedBox(height: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Row(
                      children: [
                        for (var i = 0; i < labels.length; i++) ...[
                          if (i > 0) const SizedBox(width: 6),
                          Expanded(
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              height: 4,
                              decoration: BoxDecoration(
                                color: i <= index ? c.primary : c.gray200,
                                borderRadius: BorderRadius.circular(99),
                              ),
                            ),
                          ),
                        ],
                      ],
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
