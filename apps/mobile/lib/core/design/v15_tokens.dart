import 'package:flutter/material.dart';

import 'brand_themes.dart';

/// Design V1.5: the web "Design V2" material (design.qorelly.com,
/// apps/mp/src/index.css + packages/ui/src/tray.tsx) read onto a phone.
///
/// The static values below are the light, purple reference. Anything that
/// must follow dark mode or the business brand colour reads [V15.of], which
/// resolves the same tokens for the current [Theme].
///
/// Rules carried over from web:
/// - One material: a grey tray groups things and holds white sheets.
/// - Calm, not decorated: true-neutral chrome; colour only for meaning.
/// - The number is the content: figures are the largest thing on screen.
/// - Product type is the platform's own sans (web names Inter first and falls
///   back to San Francisco / Roboto); the serif is for brand moments only.
class V15 {
  V15._();

  /// The tokens for [context]'s theme: dark or light greys, and the business
  /// brand accent. Prefer this over the static colours in anything that
  /// renders inside the app. Inside a V1.5 sheet or dialog ([V15LayerScope])
  /// the dark scale lifts a step; [lifted] forces it either way.
  static V15Colors of(BuildContext context, {bool? lifted}) =>
      V15Colors.of(context, lifted: lifted);

  // True-neutral greys (web replaced Tailwind's blue-cast gray).
  static const gray50 = Color(0xFFFAFAFA);
  static const gray100 = Color(0xFFF5F5F5);
  static const gray200 = Color(0xFFE5E5E5);
  static const gray300 = Color(0xFFD4D4D4);
  static const gray400 = Color(0xFFA3A3A3);
  static const gray500 = Color(0xFF737373);
  static const gray600 = Color(0xFF525252);
  static const gray700 = Color(0xFF404040);
  static const gray800 = Color(0xFF262626);
  static const gray900 = Color(0xFF171717);
  static const gray950 = Color(0xFF0A0A0A);

  static const surface = Color(0xFFFFFFFF);
  static const page = gray50;

  /// The brand accent: the one action that matters.
  static const primary = Color(0xFF7856FF);
  static const primaryLight = Color(0xFFF0ECFF);

  // Status tints (meaning only).
  static const successFg = Color(0xFF15803D);
  static const successBg = Color(0xFFF0FDF4);
  static const warningFg = Color(0xFFB45309);
  static const warningBg = Color(0xFFFFFBEB);
  static const dangerFg = Color(0xFFDC2626);
  static const dangerBg = Color(0xFFFEF2F2);
  static const infoFg = Color(0xFF2563EB);
  static const infoBg = Color(0xFFEFF6FF);

  // Concentric corners: tray 18 = sheet 14 + 4 inset.
  static const trayRadius = 18.0;
  static const sheetRadius = 14.0;
  static const trayInset = 4.0;

  // Large ("hero") tray: 32 around a 24 sheet, 8 inset.
  static const trayLgRadius = 32.0;
  static const sheetLgRadius = 24.0;
  static const trayLgInset = 8.0;

  // Bottom sheet = the dialog tray, rising from the edge.
  static const dialogRadius = 24.0;
  static const dialogSheetRadius = 20.0;

  /// The sheet's hairline ring + 1px soft shadow (ring-1 black/4%,
  /// shadow 0 1px 2px black/4%).
  static const hairline = Color(0x0A000000);
  static const List<BoxShadow> sheetShadow = [
    BoxShadow(color: Color(0x0A000000), offset: Offset(0, 1), blurRadius: 2),
  ];
  static const List<BoxShadow> dialogShadow = [
    BoxShadow(
      color: Color(0x59000000),
      offset: Offset(0, 24),
      blurRadius: 64,
      spreadRadius: -16,
    ),
  ];

  // Type scale (web V2 sizes; hierarchy from size + colour, not bold).
  static const _tight = -0.02;
  static TextStyle _t(
    double size,
    FontWeight weight, {
    Color color = gray900,
    double? height,
    double tracking = 0,
    bool tabular = false,
  }) => TextStyle(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: tracking * size,
    fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
  );

  static final tileFigure = _t(
    30,
    FontWeight.w500,
    height: 1,
    tracking: _tight,
    tabular: true,
  );
  static final heroFigure = _t(
    40,
    FontWeight.w500,
    height: 1,
    tracking: _tight,
    tabular: true,
  );
  static final pageTitle = _t(24, FontWeight.w600, tracking: _tight);
  static final pageSubtitle = _t(16, FontWeight.w400, color: gray500);
  static final dialogTitle = _t(
    17,
    FontWeight.w500,
    height: 1.25,
    tracking: _tight,
  );
  static final sectionTitle = _t(16, FontWeight.w500, tracking: _tight);
  static final cardHeading = _t(15, FontWeight.w500);
  static final field = _t(15, FontWeight.w400);
  static final ui = _t(14, FontWeight.w500);
  static final label = _t(13, FontWeight.w500);
  static final description = _t(
    13,
    FontWeight.w400,
    color: gray500,
    height: 20 / 13,
  );
  static final caption = _t(12, FontWeight.w500, color: gray500);
  static final micro = _t(11, FontWeight.w600, tabular: true);
  static final money = _t(15, FontWeight.w500, tabular: true);

  // ── Helpers every screen folder wrote its own copy of ──────────────────

  /// A V1.5 text style: the platform sans at [size] / [weight] in [color],
  /// -0.02em tracking when [tight] (titles, figures), tabular figures when
  /// [tabular] (money, counts, times). Same values as `V15Type.style`, with
  /// the parameter names the per-folder text helpers it replaced used.
  static TextStyle text(
    double size,
    FontWeight weight,
    Color color, {
    double? height,
    bool tight = false,
    bool tabular = false,
  }) => TextStyle(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: tight ? _tight * size : null,
    fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
  );

  /// Large text (about 1.3× and up): side-by-side keys stack, a row's
  /// trailing moves under it. The one rule the folders shared
  /// (`MediaQuery.textScalerOf(context).scale(14) > 18`).
  static bool isBigText(BuildContext context) =>
      MediaQuery.textScalerOf(context).scale(14) > 18;

  /// A V1.5 scroll view's bottom padding: clears the shell's floating tab
  /// bar (handed down as the MediaQuery bottom inset on scroll-under
  /// routes) or the home indicator, plus 16.
  static double bottomPad(BuildContext context) =>
      MediaQuery.paddingOf(context).bottom + 16;

  /// A V1.5 page list's padding: the 16 gutter, [top] (default 4) above,
  /// [bottomPad] below.
  static EdgeInsets listPadding(BuildContext context, {double top = 4}) =>
      EdgeInsets.fromLTRB(16, top, 16, bottomPad(context));
}

/// One of web's six brand accents (`@qorelly/shared/themes`): the colour, its
/// hover and pressed steps, and its pale tint. Ids and primaries are the same
/// as [kBrandThemes] (what `businesses.theme_color` stores).
@immutable
class V15Accent {
  final String id;
  final Color primary;
  final Color hover;
  final Color light;
  final Color dark;

  const V15Accent(this.id, this.primary, this.hover, this.light, this.dark);

  static const blue = V15Accent(
    'blue',
    Color(0xFF1D9BF0),
    Color(0xFF1A8CD8),
    Color(0xFFE8F5FE),
    Color(0xFF0D7BC2),
  );
  static const yellow = V15Accent(
    'yellow',
    Color(0xFFFFD400),
    Color(0xFFE6BF00),
    Color(0xFFFFF9E0),
    Color(0xFFCCA900),
  );
  static const pink = V15Accent(
    'pink',
    Color(0xFFF91880),
    Color(0xFFE01673),
    Color(0xFFFEE7F2),
    Color(0xFFC71366),
  );
  static const purple = V15Accent(
    'purple',
    Color(0xFF7856FF),
    Color(0xFF6B4DE6),
    Color(0xFFF0ECFF),
    Color(0xFF5A3FD9),
  );
  static const orange = V15Accent(
    'orange',
    Color(0xFFFF7A00),
    Color(0xFFE66E00),
    Color(0xFFFFF0E0),
    Color(0xFFCC6200),
  );
  static const green = V15Accent(
    'green',
    Color(0xFF00BA7C),
    Color(0xFF00A76F),
    Color(0xFFE0F7EF),
    Color(0xFF009563),
  );

  /// Web's order (same as [kBrandThemes]).
  static const all = [blue, yellow, pink, purple, orange, green];

  /// The accent for a theme id; unknown ids get the default, like web's
  /// `resolveThemeId`.
  static V15Accent forId(String? id) => all.firstWhere(
    (a) => a.id == id,
    orElse: () => all.firstWhere((a) => a.id == kDefaultBrandThemeId),
  );

  /// The accent whose primary is [color]. The app resolves the stored
  /// `theme_color` to one of the six primaries (`AppThemeColors.fromString`),
  /// so this is exact in practice; any other colour gets steps derived the
  /// way web's are (darker hover / pressed, a 10% tint).
  static V15Accent forColor(Color color) {
    for (final a in all) {
      if (a.primary == color) return a;
    }
    return V15Accent(
      'custom',
      color,
      Color.lerp(color, const Color(0xFF000000), 0.1)!,
      Color.lerp(color, const Color(0xFFFFFFFF), 0.9)!,
      Color.lerp(color, const Color(0xFF000000), 0.25)!,
    );
  }

  /// White, or near-black on a light accent (Sunshine Yellow) — web
  /// AppearanceV2 `onColor`.
  Color get onPrimary => onBrandColor(primary);

  @override
  bool operator ==(Object other) =>
      other is V15Accent &&
      other.id == id &&
      other.primary == primary &&
      other.hover == hover &&
      other.light == light &&
      other.dark == dark;

  @override
  int get hashCode => Object.hash(id, primary, hover, light, dark);
}

/// The V1.5 tokens resolved for one brightness and one brand accent. Lives on
/// the Design 1.5 [ThemeData] as an extension; read it with [V15.of].
///
/// Dark follows web `html[data-ui='v2'].dark`: the grey scale inverts
/// (gray-50/100 darkest, gray-900 near-white text), white sheets become the
/// #1F1F22 surface, hairline rings are drawn in white, status tints become
/// the hue at 14% with the 300 step as text.
@immutable
class V15Colors extends ThemeExtension<V15Colors> {
  final Brightness brightness;

  final Color gray50;
  final Color gray100;
  final Color gray200;
  final Color gray300;
  final Color gray400;
  final Color gray500;
  final Color gray600;
  final Color gray700;
  final Color gray800;
  final Color gray900;
  final Color gray950;

  /// White sheets (light) / #1F1F22 (dark).
  final Color surface;

  /// The scaffold: gray-50 (light) / gray-100 #111113 (dark).
  final Color page;

  /// Row dividers inside a sheet: gray-100 (light) / gray-200 (dark, web
  /// `.divide-gray-100` in dark).
  final Color divider;

  /// Sheet ring: black 4% (light) / white 9% (dark).
  final Color hairline;

  /// Quiet button / white key ring: black 6% (light) / white 9% (dark).
  final Color ringQuiet;

  /// Panel / dialog ring: black 5% (light) / white 7% (dark).
  final Color ringPanel;

  final Color primary;
  final Color primaryHover;

  /// The accent's pale tint (chips, selected rows). In dark, a deep wash:
  /// 24% of the accent mixed into #1F1F22 (web index.css).
  final Color primaryLight;
  final Color primaryDark;

  /// Text on a [primary] fill.
  final Color onPrimary;

  /// Accent-coloured text / icons on a light surface or [primaryLight].
  /// Sunshine Yellow can't be read as text on white, so it falls back to ink.
  final Color primaryInk;

  final Color successFg;
  final Color successBg;
  final Color warningFg;
  final Color warningBg;
  final Color dangerFg;
  final Color dangerBg;
  final Color infoFg;
  final Color infoBg;

  const V15Colors({
    required this.brightness,
    required this.gray50,
    required this.gray100,
    required this.gray200,
    required this.gray300,
    required this.gray400,
    required this.gray500,
    required this.gray600,
    required this.gray700,
    required this.gray800,
    required this.gray900,
    required this.gray950,
    required this.surface,
    required this.page,
    required this.divider,
    required this.hairline,
    required this.ringQuiet,
    required this.ringPanel,
    required this.primary,
    required this.primaryHover,
    required this.primaryLight,
    required this.primaryDark,
    required this.onPrimary,
    required this.primaryInk,
    required this.successFg,
    required this.successBg,
    required this.warningFg,
    required this.warningBg,
    required this.dangerFg,
    required this.dangerBg,
    required this.infoFg,
    required this.infoBg,
  });

  bool get isDark => brightness == Brightness.dark;

  /// The tokens for a brightness and an accent.
  factory V15Colors.resolve(
    Brightness brightness, [
    V15Accent accent = V15Accent.purple,
  ]) {
    final onPrimary = accent.onPrimary;
    final lightAccent = onPrimary != const Color(0xFFFFFFFF);
    if (brightness == Brightness.dark) {
      const surface = Color(0xFF1F1F22);
      return V15Colors(
        brightness: brightness,
        gray50: const Color(0xFF0D0D0F),
        gray100: const Color(0xFF111113),
        gray200: const Color(0xFF2C2C2F),
        gray300: const Color(0xFF3E3E42),
        gray400: const Color(0xFF707076),
        gray500: const Color(0xFF94949A),
        gray600: const Color(0xFFB2B2B8),
        gray700: const Color(0xFFCECED3),
        gray800: const Color(0xFFE4E4E7),
        gray900: const Color(0xFFF3F3F5),
        gray950: const Color(0xFFFAFAFA),
        surface: surface,
        // Web's dark trays (gray-100) sit on the #1F1F22 content panel;
        // mobile has no panel, so the page takes its colour — trays read as
        // darker wells and the sheets inside them lift back to the surface.
        page: surface,
        divider: const Color(0xFF2C2C2F),
        hairline: const Color(0x17FFFFFF),
        ringQuiet: const Color(0x17FFFFFF),
        ringPanel: const Color(0x12FFFFFF),
        primary: accent.primary,
        primaryHover: accent.hover,
        primaryLight: Color.lerp(surface, accent.primary, 0.24)!,
        primaryDark: accent.dark,
        onPrimary: onPrimary,
        primaryInk: accent.primary,
        successFg: const Color(0xFF86EFAC),
        successBg: const Color(0x2422C55E),
        warningFg: const Color(0xFFFCD34D),
        warningBg: const Color(0x24F59E0B),
        dangerFg: const Color(0xFFFCA5A5),
        dangerBg: const Color(0x24EF4444),
        infoFg: const Color(0xFF93C5FD),
        infoBg: const Color(0x243B82F6),
      );
    }
    return V15Colors(
      brightness: brightness,
      gray50: V15.gray50,
      gray100: V15.gray100,
      gray200: V15.gray200,
      gray300: V15.gray300,
      gray400: V15.gray400,
      gray500: V15.gray500,
      gray600: V15.gray600,
      gray700: V15.gray700,
      gray800: V15.gray800,
      gray900: V15.gray900,
      gray950: V15.gray950,
      surface: V15.surface,
      page: V15.page,
      divider: V15.gray100,
      hairline: V15.hairline,
      ringQuiet: const Color(0x0F000000),
      ringPanel: const Color(0x0D000000),
      primary: accent.primary,
      primaryHover: accent.hover,
      primaryLight: accent.light,
      primaryDark: accent.dark,
      onPrimary: onPrimary,
      primaryInk: lightAccent ? V15.gray900 : accent.primary,
      successFg: V15.successFg,
      successBg: V15.successBg,
      warningFg: V15.warningFg,
      warningBg: V15.warningBg,
      dangerFg: V15.dangerFg,
      dangerBg: V15.dangerBg,
      infoFg: V15.infoFg,
      infoBg: V15.infoBg,
    );
  }

  /// The tokens for [context]: the Design 1.5 theme's own extension, or —
  /// under a theme without one (the current design, tests) — the same values
  /// resolved from its brightness and primary colour.
  ///
  /// Inside a raised layer — a V1.5 bottom sheet or dialog, marked by
  /// [V15LayerScope] — the dark scale lifts a step ([V15Colors.lifted]), so
  /// every kit piece drawn in a sheet reads above the page. [lifted] forces
  /// the raised scale on (true) or off (false) whatever the layer.
  static V15Colors of(BuildContext context, {bool? lifted}) {
    final theme = Theme.of(context);
    final base =
        theme.extension<V15Colors>() ??
        V15Colors.resolve(
          theme.brightness,
          V15Accent.forColor(theme.colorScheme.primary),
        );
    final up = lifted ?? V15LayerScope.maybeOf(context) != null;
    return up ? base.lifted : base;
  }

  static final Expando<V15Colors> _liftedCache = Expando('v15-lifted');

  /// Inside dialogs, sheets and menus the dark scale lifts a step so the
  /// raised object reads above the page (web v2-dialog.css): surface
  /// rgb(38,38,42), gray-50 rgb(24,24,27), gray-100 rgb(28,28,31), gray-200
  /// rgb(52,52,56), gray-300 rgb(70,70,75). Light is unchanged. Idempotent.
  V15Colors get lifted {
    if (!isDark) return this;
    return _liftedCache[this] ??= _lift();
  }

  V15Colors _lift() {
    const surface = Color(0xFF26262A);
    return copyWith(
      surface: surface,
      gray50: const Color(0xFF18181B),
      gray100: const Color(0xFF1C1C1F),
      gray200: const Color(0xFF343438),
      gray300: const Color(0xFF46464B),
      divider: const Color(0xFF343438),
      primaryLight: Color.lerp(surface, primary, 0.24),
    );
  }

  // ── Roles (web `html[data-ui='v2']`), one source for the whole app ──────
  // Formerly on V15Palette (lib/widgets/v15_style.dart), which now forwards
  // here. Values unchanged.

  /// Same as [isDark].
  bool get dark => isDark;

  /// A white sheet's ring in a tray (black 4% / white 9%).
  Color get sheetRing => hairline;

  /// The quiet (white key) button ring (black 6% / white 9%).
  Color get quietRing => ringQuiet;

  /// A dialog / floating panel ring (black 5% / white 7%).
  Color get dialogRing => ringPanel;

  /// The sheet's 1px soft shadow (0 1px 2px black/4%).
  List<BoxShadow> get sheetShadow => V15.sheetShadow;

  /// The dialog's drop shadow (deeper in dark).
  List<BoxShadow> get dialogShadow => isDark
      ? const [
          BoxShadow(
            color: Color(0x99000000),
            offset: Offset(0, 24),
            blurRadius: 64,
            spreadRadius: -12,
          ),
        ]
      : V15.dialogShadow;

  /// The dimmer behind dialogs and sheets (black 40%; 60% in dark).
  Color get barrier =>
      isDark ? const Color(0x99000000) : const Color(0x66000000);

  Color get redBg => isDark ? const Color(0x24EF4444) : const Color(0xFFFEF2F2);
  Color get redFg => isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626);
  Color get redInk =>
      isDark ? const Color(0xFFFCA5A5) : const Color(0xFF991B1B);
  Color get redBorder =>
      isDark ? const Color(0x38EF4444) : const Color(0xFFFCA5A5);
  Color get redRing => const Color(0x1AEF4444);

  /// A filled destructive button (red-600, white label) in both modes.
  Color get redSolid => const Color(0xFFDC2626);

  Color get amberBg =>
      isDark ? const Color(0x24F59E0B) : const Color(0xFFFFFBEB);
  Color get amberFg =>
      isDark ? const Color(0xFFFCD34D) : const Color(0xFFB45309);
  Color get amberInk =>
      isDark ? const Color(0xFFFCD34D) : const Color(0xFF78350F);
  Color get amberDot => const Color(0xFFF59E0B);

  Color get greenBg =>
      isDark ? const Color(0x2410B981) : const Color(0xFFECFDF5);
  Color get greenFg =>
      isDark ? const Color(0xFF6EE7B7) : const Color(0xFF047857);
  Color get greenDot => const Color(0xFF10B981);

  Color get blueBg =>
      isDark ? const Color(0x243B82F6) : const Color(0xFFEFF6FF);
  Color get blueFg =>
      isDark ? const Color(0xFF93C5FD) : const Color(0xFF1D4ED8);
  Color get blueDot => const Color(0xFF3B82F6);

  /// The skeleton block (web `bg-gray-200/90`) and its shimmer sweep.
  Color get skeletonBase => gray200;
  Color get skeletonHighlight => isDark ? gray300 : gray100;

  @override
  V15Colors copyWith({
    Brightness? brightness,
    Color? gray50,
    Color? gray100,
    Color? gray200,
    Color? gray300,
    Color? gray400,
    Color? gray500,
    Color? gray600,
    Color? gray700,
    Color? gray800,
    Color? gray900,
    Color? gray950,
    Color? surface,
    Color? page,
    Color? divider,
    Color? hairline,
    Color? ringQuiet,
    Color? ringPanel,
    Color? primary,
    Color? primaryHover,
    Color? primaryLight,
    Color? primaryDark,
    Color? onPrimary,
    Color? primaryInk,
    Color? successFg,
    Color? successBg,
    Color? warningFg,
    Color? warningBg,
    Color? dangerFg,
    Color? dangerBg,
    Color? infoFg,
    Color? infoBg,
  }) => V15Colors(
    brightness: brightness ?? this.brightness,
    gray50: gray50 ?? this.gray50,
    gray100: gray100 ?? this.gray100,
    gray200: gray200 ?? this.gray200,
    gray300: gray300 ?? this.gray300,
    gray400: gray400 ?? this.gray400,
    gray500: gray500 ?? this.gray500,
    gray600: gray600 ?? this.gray600,
    gray700: gray700 ?? this.gray700,
    gray800: gray800 ?? this.gray800,
    gray900: gray900 ?? this.gray900,
    gray950: gray950 ?? this.gray950,
    surface: surface ?? this.surface,
    page: page ?? this.page,
    divider: divider ?? this.divider,
    hairline: hairline ?? this.hairline,
    ringQuiet: ringQuiet ?? this.ringQuiet,
    ringPanel: ringPanel ?? this.ringPanel,
    primary: primary ?? this.primary,
    primaryHover: primaryHover ?? this.primaryHover,
    primaryLight: primaryLight ?? this.primaryLight,
    primaryDark: primaryDark ?? this.primaryDark,
    onPrimary: onPrimary ?? this.onPrimary,
    primaryInk: primaryInk ?? this.primaryInk,
    successFg: successFg ?? this.successFg,
    successBg: successBg ?? this.successBg,
    warningFg: warningFg ?? this.warningFg,
    warningBg: warningBg ?? this.warningBg,
    dangerFg: dangerFg ?? this.dangerFg,
    dangerBg: dangerBg ?? this.dangerBg,
    infoFg: infoFg ?? this.infoFg,
    infoBg: infoBg ?? this.infoBg,
  );

  @override
  V15Colors lerp(covariant ThemeExtension<V15Colors>? other, double t) {
    if (other is! V15Colors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return V15Colors(
      brightness: t < 0.5 ? brightness : other.brightness,
      gray50: l(gray50, other.gray50),
      gray100: l(gray100, other.gray100),
      gray200: l(gray200, other.gray200),
      gray300: l(gray300, other.gray300),
      gray400: l(gray400, other.gray400),
      gray500: l(gray500, other.gray500),
      gray600: l(gray600, other.gray600),
      gray700: l(gray700, other.gray700),
      gray800: l(gray800, other.gray800),
      gray900: l(gray900, other.gray900),
      gray950: l(gray950, other.gray950),
      surface: l(surface, other.surface),
      page: l(page, other.page),
      divider: l(divider, other.divider),
      hairline: l(hairline, other.hairline),
      ringQuiet: l(ringQuiet, other.ringQuiet),
      ringPanel: l(ringPanel, other.ringPanel),
      primary: l(primary, other.primary),
      primaryHover: l(primaryHover, other.primaryHover),
      primaryLight: l(primaryLight, other.primaryLight),
      primaryDark: l(primaryDark, other.primaryDark),
      onPrimary: l(onPrimary, other.onPrimary),
      primaryInk: l(primaryInk, other.primaryInk),
      successFg: l(successFg, other.successFg),
      successBg: l(successBg, other.successBg),
      warningFg: l(warningFg, other.warningFg),
      warningBg: l(warningBg, other.warningBg),
      dangerFg: l(dangerFg, other.dangerFg),
      dangerBg: l(dangerBg, other.dangerBg),
      infoFg: l(infoFg, other.infoFg),
      infoBg: l(infoBg, other.infoBg),
    );
  }
}

/// Marks a raised layer (a V1.5 bottom sheet or dialog). In dark mode the
/// neutral scale lifts inside it — [V15.of] / [V15Colors.of] return the
/// [V15Colors.lifted] tokens below it — and [sheetKey] (the white sheet the
/// layer's content sits on) lets a sheet header put its title on the tray.
///
/// Also exported from lib/widgets/v15_style.dart, where it used to live.
class V15LayerScope extends InheritedWidget {
  final GlobalKey? sheetKey;

  const V15LayerScope({super.key, this.sheetKey, required super.child});

  static V15LayerScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<V15LayerScope>();

  @override
  bool updateShouldNotify(V15LayerScope old) => old.sheetKey != sheetKey;
}
