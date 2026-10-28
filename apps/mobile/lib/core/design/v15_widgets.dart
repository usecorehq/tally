import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import 'rich/v15_motion.dart';
import 'rich/v15_pulse_skeleton.dart';
import 'tally_icons.dart';
import 'v15_tokens.dart';

export 'rich/v15_pulse_skeleton.dart' show V15PulseSkeleton;
export 'tally_icons.dart';
export 'v15_theme.dart';
export 'v15_tokens.dart';

// The Design 1.5 kit Tally uses: a subset of qorelly-mobile's
// lib/core/design/v15_widgets.dart + v15_parts.dart with the same names and
// look, minus its Riverpod / go_router / offline ties. Colours come from
// [V15.of] (dark mode, brand accent); sizes, radii and type are [V15] tokens.
// Port more pieces from there rather than drawing new ones.

/// Web V2Button corners (rounded-xl).
const double kV15ButtonRadius = 12;

/// What a failed read shows in place of a figure — never 0.
const String kV15NoFigure = '–';

/// A grey well that groups things (Tray): 18px corners, 4px inset.
class V15Tray extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const V15Tray({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(V15.trayInset),
  });

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: c.gray100,
        borderRadius: BorderRadius.circular(V15.trayRadius),
      ),
      child: child,
    );
  }
}

/// The white surface set in a tray (TraySheet): 14px corners, hairline ring,
/// 1px soft shadow. Carries a transparent [Material] so row ink shows.
class V15Sheet extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const V15Sheet({super.key, required this.child, this.padding = EdgeInsets.zero});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Container(
      padding: padding,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(V15.sheetRadius),
        border: Border.all(color: c.hairline),
        boxShadow: V15.sheetShadow,
      ),
      child: Material(type: MaterialType.transparency, child: child),
    );
  }
}

/// A titled tray: title and count on the grey, rows on one white sheet,
/// divided by shade-of-grey hairlines.
class V15Section extends StatelessWidget {
  final String? title;
  final int? count;
  final Widget? action;
  final List<Widget> rows;
  const V15Section({super.key, this.title, this.count, this.action, required this.rows});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return V15Tray(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 6),
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      title!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: V15.label.copyWith(color: c.gray600),
                    ),
                  ),
                  if (count != null) ...[
                    const SizedBox(width: 6),
                    Text('$count', style: V15.micro.copyWith(color: c.gray400)),
                  ],
                  const Spacer(),
                  ?action,
                ],
              ),
            ),
          V15Sheet(
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) Divider(height: 1, thickness: 1, indent: 14, color: c.divider),
                  rows[i],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A metric well: quiet label, large tabular figure. No border, no icon chip.
class V15Tile extends StatelessWidget {
  final String label;

  /// Null while pending (a skeleton); [kV15NoFigure] after a failed read.
  final String? value;
  final bool warn;
  const V15Tile({super.key, required this.label, required this.value, this.warn = false});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.gray100,
        borderRadius: BorderRadius.circular(V15.sheetRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: V15.label.copyWith(color: c.gray500)),
          const SizedBox(height: 6),
          value == null
              ? const V15PulseSkeleton(width: 48, height: 30)
              : Text(
                  value!,
                  maxLines: 1,
                  style: V15.tileFigure.copyWith(color: warn ? c.amberFg : c.gray900),
                ),
        ],
      ),
    );
  }
}

enum V15Tone { primary, quiet, soft, dark }

class V15Button extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final V15Tone tone;
  final double height;
  final IconData? icon;
  final bool expand;
  const V15Button(
    this.label, {
    super.key,
    this.onPressed,
    this.tone = V15Tone.primary,
    this.height = 44,
    this.icon,
    this.expand = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (bg, fg, ring) = switch (tone) {
      V15Tone.primary => (c.primary, c.onPrimary, false),
      V15Tone.quiet => (c.surface, c.gray900, true),
      V15Tone.soft => (c.gray100, c.gray900, false),
      V15Tone.dark => (c.gray900, c.surface, false),
    };
    return _Pressable(
      onTap: onPressed,
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(kV15ButtonRadius),
          border: ring ? Border.all(color: c.ringQuiet) : null,
          boxShadow: ring ? V15.sheetShadow : null,
        ),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[Icon(icon, size: 18, color: fg), const SizedBox(width: 8)],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: (height >= 48 ? V15.cardHeading : V15.ui).copyWith(color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Square icon button (V2IconButton): 40×40, rounded-xl.
class V15IconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final String tooltip;
  const V15IconButton(this.icon, {super.key, this.onPressed, required this.tooltip});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: tooltip,
        excludeSemantics: true,
        child: _Pressable(
          onTap: onPressed,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: c.gray100,
              borderRadius: BorderRadius.circular(kV15ButtonRadius),
            ),
            child: Icon(icon, size: 20, color: c.gray700),
          ),
        ),
      ),
    );
  }
}

/// active:scale-[0.97] — the press feedback every V2 control has.
class _Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _Pressable({required this.child, this.onTap});

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTapDown: (_) => setState(() => _down = true),
    onTapUp: (_) => setState(() => _down = false),
    onTapCancel: () => setState(() => _down = false),
    onTap: widget.onTap,
    child: AnimatedScale(
      scale: _down && !V15Motion.reduced(context) ? 0.97 : 1,
      duration: const Duration(milliseconds: 120),
      child: Opacity(opacity: widget.onTap == null ? 0.4 : 1, child: widget.child),
    ),
  );
}

enum V15PillTone { green, amber, red, blue, violet, gray }

/// Status pill: full radius, 6px dot, 12 medium.
class V15Pill extends StatelessWidget {
  final String text;
  final V15PillTone tone;
  const V15Pill(this.text, {super.key, this.tone = V15PillTone.gray});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    // (light bg, light text, dot, dark text)
    final (bg, fg, dot, darkFg) = switch (tone) {
      V15PillTone.green => (const Color(0xFFECFDF5), const Color(0xFF047857), const Color(0xFF10B981), const Color(0xFF6EE7B7)),
      V15PillTone.amber => (const Color(0xFFFFFBEB), const Color(0xFFB45309), const Color(0xFFF59E0B), const Color(0xFFFCD34D)),
      V15PillTone.red => (const Color(0xFFFEF2F2), const Color(0xFFDC2626), const Color(0xFFEF4444), const Color(0xFFFCA5A5)),
      V15PillTone.blue => (const Color(0xFFEFF6FF), const Color(0xFF1D4ED8), const Color(0xFF3B82F6), const Color(0xFF93C5FD)),
      V15PillTone.violet => (const Color(0xFFF5F3FF), const Color(0xFF6D28D9), const Color(0xFF8B5CF6), const Color(0xFFC4B5FD)),
      V15PillTone.gray => (c.gray100, c.gray600, c.gray400, c.gray600),
    };
    final isGray = tone == V15PillTone.gray;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: c.isDark && !isGray ? dot.withValues(alpha: 0.14) : bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: V15.caption.copyWith(color: c.isDark ? darkFg : fg, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

/// A list row: px14 py12, the whole row is the target, numbers on the right.
class V15Row extends StatelessWidget {
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  const V15Row({super.key, this.leading, required this.title, this.subtitle, this.trailing, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 12)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: V15.cardHeading.copyWith(color: c.gray900),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: V15.description.copyWith(color: c.gray500),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 12), trailing!],
            ],
          ),
        ),
      ),
    );
  }
}

/// A 40 disc with an 18 glyph — the leading mark of a row or empty state.
class V15IconTile extends StatelessWidget {
  final IconData icon;
  const V15IconTile(this.icon, {super.key});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(color: c.gray100, shape: BoxShape.circle),
      child: Icon(icon, size: 18, color: c.gray600),
    );
  }
}

/// Search well: gray-100 fill, 44 tall, r12, no border in any state.
class V15Search extends StatelessWidget {
  final String hint;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  const V15Search(this.hint, {super.key, this.controller, this.onChanged, this.onSubmitted});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final none = OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none);
    return SizedBox(
      height: 44,
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        textInputAction: TextInputAction.search,
        style: V15.field.copyWith(color: c.gray900),
        cursorColor: c.gray900,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: V15.field.copyWith(color: c.gray400),
          filled: true,
          fillColor: c.gray100,
          contentPadding: EdgeInsets.zero,
          prefixIcon: Icon(IconsOutline.magnifer, size: 18, color: c.gray400),
          border: none,
          enabledBorder: none,
          focusedBorder: none,
          disabledBorder: none,
        ),
      ),
    );
  }
}

enum V15NoticeTone { neutral, brand, warn, error }

/// Notice (V2Notice): 14px corners, 13/20 text, colour for meaning only.
class V15Notice extends StatelessWidget {
  final String title;
  final String? body;
  final IconData? icon;
  final V15NoticeTone tone;
  const V15Notice({super.key, required this.title, this.body, this.icon, this.tone = V15NoticeTone.neutral});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (bg, ink, bodyInk) = switch (tone) {
      V15NoticeTone.neutral => (c.gray100, c.gray900, c.gray600),
      V15NoticeTone.brand => (c.primaryLight, c.gray900, c.gray700),
      V15NoticeTone.warn => c.isDark
          ? (const Color(0x24F59E0B), const Color(0xFFFDE68A), const Color(0xFFFCD34D))
          : (const Color(0xFFFFFBEB), const Color(0xFF78350F), const Color(0xFF92400E)),
      V15NoticeTone.error => c.isDark
          ? (const Color(0x24EF4444), const Color(0xFFFECACA), const Color(0xFFFCA5A5))
          : (const Color(0xFFFEF2F2), const Color(0xFF7F1D1D), const Color(0xFF991B1B)),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(icon, size: 16, color: tone == V15NoticeTone.brand ? c.primaryInk : ink),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: V15.label.copyWith(color: ink, height: 20 / 13)),
                if (body != null) Text(body!, style: V15.description.copyWith(color: bodyInk)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Page header: optional quiet eyebrow, 28 semibold title, actions on the right.
class V15PageHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  const V15PageHeader({super.key, required this.title, this.subtitle, this.actions = const []});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 16, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (subtitle != null)
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: V15.label.copyWith(color: c.gray500, fontWeight: FontWeight.w400),
                  ),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: V15.pageTitle.copyWith(fontSize: 28, letterSpacing: -0.56, color: c.gray900),
                ),
              ],
            ),
          ),
          for (final a in actions) ...[const SizedBox(width: 8), a],
        ],
      ),
    );
  }
}

const List<BoxShadow> _kV15TabBarShadow = [
  BoxShadow(color: Color(0x1A000000), offset: Offset(0, 8), blurRadius: 24, spreadRadius: -8),
];

/// The floating bottom tab bar: a frosted grey tray, the selected tab a white
/// sheet with the Fill glyph, the rest Outline.
class V15TabBar extends StatelessWidget {
  final List<(IconData fill, IconData outline, String label)> items;
  final int index;
  final ValueChanged<int> onTap;
  const V15TabBar({super.key, required this.items, required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final radius = BorderRadius.circular(22);
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      // Shadows mean floating: the bar floats, so it frosts what scrolls under it.
      child: DecoratedBox(
        decoration: BoxDecoration(borderRadius: radius, boxShadow: _kV15TabBarShadow),
        child: ClipRRect(
          borderRadius: radius,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: c.gray100.withValues(alpha: 0.82),
                borderRadius: radius,
                border: Border.all(color: c.ringQuiet),
              ),
              child: Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: Semantics(
                        selected: i == index,
                        button: true,
                        label: items[i].$3,
                        excludeSemantics: true,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => onTap(i),
                          child: _tab(c, i, i == index),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _tab(V15Colors c, int i, bool selected) {
    final color = selected ? c.gray900 : c.gray500;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
      height: 52,
      decoration: BoxDecoration(
        color: selected ? c.surface : Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        boxShadow: selected ? V15.sheetShadow : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(selected ? items[i].$1 : items[i].$2, size: 22, color: color),
          const SizedBox(height: 2),
          Text(items[i].$3, maxLines: 1, style: V15.micro.copyWith(color: color, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ─── Honest states ──────────────────────────────────────────────────────────

/// Pending rows: a leading disc and two lines per row, pulsing.
class V15SkeletonRows extends StatelessWidget {
  final int count;
  const V15SkeletonRows({super.key, this.count = 5});

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading',
    child: Column(
      children: [
        for (var i = 0; i < count; i++)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                V15PulseSkeleton(width: 40, height: 40, shape: BoxShape.circle, semanticLabel: null),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      V15PulseSkeleton(width: 160, height: 14, semanticLabel: null),
                      SizedBox(height: 6),
                      V15PulseSkeleton(width: 96, height: 12, semanticLabel: null),
                    ],
                  ),
                ),
                V15PulseSkeleton(width: 32, height: 16, semanticLabel: null),
              ],
            ),
          ),
      ],
    ),
  );
}

/// A failed read inside a sheet: the reason and a quiet Retry key.
class V15ErrorRow extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const V15ErrorRow(this.message, {super.key, this.onRetry});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: Row(
        children: [
          Icon(IconsOutline.danger_circle, size: 18, color: c.redFg),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: V15.ui.copyWith(color: c.gray700, fontWeight: FontWeight.w400))),
          if (onRetry != null) ...[
            const SizedBox(width: 8),
            V15Button('Retry', tone: V15Tone.quiet, height: 40, onPressed: onRetry),
          ],
        ],
      ),
    );
  }
}

/// A full-screen message: 40 disc + 18 glyph, medium title, grey body, one key.
class V15MessageState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;
  const V15MessageState({super.key, required this.icon, required this.title, this.body, this.action});

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            V15IconTile(icon),
            const SizedBox(height: 14),
            Text(title, textAlign: TextAlign.center, style: V15.cardHeading.copyWith(color: c.gray900)),
            if (body != null) ...[
              const SizedBox(height: 4),
              Text(body!, textAlign: TextAlign.center, style: V15.description.copyWith(color: c.gray500)),
            ],
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}
