import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'v15_tokens.dart';

/// Design 1.5 [ThemeData]: web Design V2 (design.qorelly.com) as Material
/// component themes, so plain Material widgets already sit in the V2
/// material before each screen is restyled.
///
/// - Product type is the platform's own sans (SF / Roboto): no fontFamily.
/// - True-neutral greys; colour only for meaning. The business brand colour
///   tints the one primary action, selection and switches.
/// - Buttons are 44 tall with r12 corners and NEVER an infinite minimum width:
///   inside a Row that is an unbounded constraint and the whole body renders
///   blank. Full-width buttons take their width from their parent.
/// - No elevation tint anywhere (surfaceTintColor transparent).
///
/// Built once per (brightness, accent) and cached; [V15Colors] rides along
/// as a theme extension for [V15.of].
abstract final class V15Theme {
  static final Map<(Brightness, V15Accent), ThemeData> _cache = {};

  static ThemeData light([V15Accent accent = V15Accent.purple]) =>
      build(Brightness.light, accent);

  static ThemeData dark([V15Accent accent = V15Accent.purple]) =>
      build(Brightness.dark, accent);

  static ThemeData build(Brightness brightness, V15Accent accent) =>
      _cache.putIfAbsent((brightness, accent), () => _build(brightness, accent));

  static const _r8 = BorderRadius.all(Radius.circular(8));
  static const _r12 = BorderRadius.all(Radius.circular(12));
  static const _r14 = BorderRadius.all(Radius.circular(V15.sheetRadius));
  static const _r24 = BorderRadius.all(Radius.circular(V15.dialogRadius));

  /// red-300: the invalid field border (V2_FIELD aria-invalid).
  static const _red300 = Color(0xFFFCA5A5);

  /// black/40 behind dialogs and sheets.
  static const _barrier = Color(0x66000000);

  /// Menus float, so they keep a soft shadow (Shadows mean floating).
  static const _menuShadow = Color(0x40000000);

  /// The V2 minimum: 64 wide so a one-word label still reads as a key, 44
  /// tall (lg, the default). Width stays finite on purpose — see class doc.
  static const _buttonMin = Size(64, 44);
  static const _buttonPad = EdgeInsets.symmetric(horizontal: 16);
  static const _buttonShape = RoundedRectangleBorder(borderRadius: _r12);
  static const _buttonText = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    letterSpacing: 0,
  );

  static TextStyle _t(
    double size,
    FontWeight weight,
    Color? color, {
    double? height,
    bool tight = false,
    bool tabular = false,
  }) => TextStyle(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    // "tight" ≈ -0.02em; everything else untracked like web.
    letterSpacing: tight ? -0.02 * size : 0,
    fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
  );

  static ThemeData _build(Brightness brightness, V15Accent accent) {
    final c = V15Colors.resolve(brightness, accent);
    // Dialogs, sheets and menus: the dark scale lifts a step.
    final raised = c.lifted;
    final isDark = c.isDark;
    final ink = c.gray900;

    final scheme = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryLight,
      onPrimaryContainer: c.primaryInk,
      // Secondary / tertiary stay neutral: colour only for meaning.
      secondary: c.gray900,
      onSecondary: c.surface,
      secondaryContainer: c.gray100,
      onSecondaryContainer: c.gray900,
      tertiary: c.gray700,
      onTertiary: c.surface,
      tertiaryContainer: c.gray100,
      onTertiaryContainer: c.gray900,
      error: c.dangerFg,
      onError: isDark ? c.gray50 : Colors.white,
      errorContainer: c.dangerBg,
      onErrorContainer: c.dangerFg,
      surface: c.surface,
      onSurface: c.gray900,
      onSurfaceVariant: c.gray500,
      surfaceDim: c.gray100,
      surfaceBright: c.surface,
      surfaceContainerLowest: c.surface,
      surfaceContainerLow: c.gray50,
      surfaceContainer: c.gray100,
      surfaceContainerHigh: c.gray100,
      surfaceContainerHighest: c.gray200,
      outline: c.gray300,
      outlineVariant: c.gray200,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: c.gray900,
      onInverseSurface: c.gray50,
      inversePrimary: c.primaryLight,
      surfaceTint: Colors.transparent,
    );

    // Web V2 type scale: hierarchy from size + colour, weights 400/500/600.
    final textTheme = TextTheme(
      // Hero figure / tile figure: the number is the content.
      displayLarge: _t(
        40,
        FontWeight.w500,
        ink,
        height: 1,
        tight: true,
        tabular: true,
      ),
      displayMedium: _t(
        30,
        FontWeight.w500,
        ink,
        height: 1,
        tight: true,
        tabular: true,
      ),
      // Mobile page header.
      displaySmall: _t(28, FontWeight.w600, ink, tight: true),
      // Page title / flow title.
      headlineLarge: _t(24, FontWeight.w600, ink, tight: true),
      headlineMedium: _t(24, FontWeight.w500, ink, tight: true),
      // Dialog title (AlertDialog's default slot).
      headlineSmall: _t(17, FontWeight.w500, ink, height: 1.25, tight: true),
      // App bar title (AppBar's default slot).
      titleLarge: _t(17, FontWeight.w500, ink, tight: true),
      // Section title / card heading.
      titleMedium: _t(16, FontWeight.w500, ink, tight: true),
      titleSmall: _t(15, FontWeight.w500, ink),
      // Field / row title, default body.
      bodyLarge: _t(15, FontWeight.w400, ink),
      bodyMedium: _t(14, FontWeight.w400, ink),
      // Description 13/20, also helper text.
      bodySmall: _t(13, FontWeight.w400, c.gray500, height: 20 / 13),
      // UI / button, caption, micro.
      labelLarge: _t(14, FontWeight.w500, ink),
      labelMedium: _t(12, FontWeight.w500, c.gray500),
      labelSmall: _t(11, FontWeight.w600, ink, tabular: true),
    );

    // ── Buttons ──────────────────────────────────────────────────────────
    // primary: bg-primary; pressed steps to the accent's hover shade.
    final primaryButton =
        ElevatedButton.styleFrom(
          foregroundColor: c.onPrimary,
          backgroundColor: c.primary,
          disabledForegroundColor: c.onPrimary.withValues(alpha: 0.4),
          disabledBackgroundColor: c.primary.withValues(alpha: 0.4),
          shadowColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          minimumSize: _buttonMin,
          padding: _buttonPad,
          shape: _buttonShape,
          textStyle: _buttonText,
          iconSize: 16,
        ).copyWith(
          backgroundColor: WidgetStateProperty.resolveWith((s) {
            if (s.contains(WidgetState.disabled)) {
              return c.primary.withValues(alpha: 0.4);
            }
            if (s.contains(WidgetState.pressed)) return c.primaryHover;
            return c.primary;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          elevation: const WidgetStatePropertyAll(0),
        );

    // quiet: a white key with a 6% ring.
    final quietButton =
        OutlinedButton.styleFrom(
          foregroundColor: c.gray900,
          backgroundColor: c.surface,
          disabledForegroundColor: c.gray900.withValues(alpha: 0.4),
          disabledBackgroundColor: c.surface.withValues(alpha: 0.4),
          side: BorderSide(color: c.ringQuiet),
          minimumSize: _buttonMin,
          padding: _buttonPad,
          shape: _buttonShape,
          textStyle: _buttonText,
          iconSize: 16,
        ).copyWith(
          backgroundColor: WidgetStateProperty.resolveWith((s) {
            if (s.contains(WidgetState.disabled)) {
              return c.surface.withValues(alpha: 0.4);
            }
            if (s.contains(WidgetState.pressed)) return c.gray50;
            return c.surface;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        );

    // ghost: ink on nothing; a faint wash while pressed.
    final ghostButton =
        TextButton.styleFrom(
          foregroundColor: c.gray900,
          disabledForegroundColor: c.gray400,
          minimumSize: _buttonMin,
          padding: _buttonPad,
          shape: _buttonShape,
          textStyle: _buttonText,
          iconSize: 16,
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((s) {
            if (s.contains(WidgetState.pressed)) {
              return c.gray900.withValues(alpha: 0.06);
            }
            if (s.contains(WidgetState.hovered)) {
              return c.gray900.withValues(alpha: 0.04);
            }
            return null;
          }),
        );

    // Filled takes its colours from the scheme, so FilledButton is the
    // primary tone and FilledButton.tonal the soft one (gray-100 / ink).
    final filledButton = FilledButton.styleFrom(
      minimumSize: _buttonMin,
      padding: _buttonPad,
      shape: _buttonShape,
      textStyle: _buttonText,
      iconSize: 16,
      elevation: 0,
      shadowColor: Colors.transparent,
    );

    // ── Fields (V2_FIELD) ────────────────────────────────────────────────
    OutlineInputBorder field(Color color) => OutlineInputBorder(
      borderRadius: _r14,
      borderSide: BorderSide(color: color),
    );

    // ── Menus: the sheet look, floating ──────────────────────────────────
    final menuStyle = MenuStyle(
      backgroundColor: WidgetStatePropertyAll(raised.surface),
      surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
      shadowColor: const WidgetStatePropertyAll(_menuShadow),
      elevation: const WidgetStatePropertyAll(8),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(vertical: 4),
      ),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(
          borderRadius: _r14,
          side: BorderSide(color: c.ringPanel),
        ),
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      textTheme: textTheme,
      // Platform sans (web: Inter → SF / Roboto). Never GoogleSans here.
      fontFamily: null,
      scaffoldBackgroundColor: c.page,
      canvasColor: c.surface,
      dividerColor: c.divider,
      hintColor: c.gray400,
      extensions: [c],

      // Same as today: no Material ripples; press feedback is the overlay /
      // pressed colour (and PressableScale on shared components).
      splashFactory: NoSplash.splashFactory,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,

      appBarTheme: AppBarThemeData(
        backgroundColor: c.page,
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        titleTextStyle: _t(17, FontWeight.w500, ink, tight: true),
        iconTheme: IconThemeData(color: ink, size: 20),
        actionsIconTheme: IconThemeData(color: c.gray700, size: 20),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(style: primaryButton),
      filledButtonTheme: FilledButtonThemeData(style: filledButton),
      outlinedButtonTheme: OutlinedButtonThemeData(style: quietButton),
      textButtonTheme: TextButtonThemeData(style: ghostButton),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: c.gray700,
          shape: _buttonShape,
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: c.primary,
        foregroundColor: c.onPrimary,
        elevation: 2,
        focusElevation: 2,
        hoverElevation: 2,
        highlightElevation: 2,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),

      inputDecorationTheme: InputDecorationThemeData(
        filled: true,
        // gray-50 at rest, white while focused (V2_FIELD focus:bg-white).
        fillColor: WidgetStateColor.resolveWith((s) {
          if (s.contains(WidgetState.disabled)) return c.gray100;
          if (s.contains(WidgetState.focused)) return c.surface;
          return c.gray50;
        }),
        hoverColor: Colors.transparent,
        border: field(c.gray200),
        enabledBorder: field(c.gray200),
        disabledBorder: field(c.gray100),
        focusedBorder: field(c.gray300),
        errorBorder: field(_red300),
        focusedErrorBorder: field(_red300),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        hintStyle: _t(15, FontWeight.w400, c.gray400),
        labelStyle: _t(15, FontWeight.w400, c.gray500),
        floatingLabelStyle: _t(13, FontWeight.w500, c.gray700),
        helperStyle: _t(13, FontWeight.w400, c.gray500),
        errorStyle: _t(13, FontWeight.w400, c.dangerFg),
        prefixStyle: _t(15, FontWeight.w400, c.gray500),
        suffixStyle: _t(15, FontWeight.w400, c.gray500),
        counterStyle: _t(12, FontWeight.w400, c.gray400),
        prefixIconColor: c.gray400,
        suffixIconColor: c.gray400,
        iconColor: c.gray500,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: ink,
        selectionColor: c.primary.withValues(alpha: 0.24),
        selectionHandleColor: c.primary,
      ),

      // The dialog tray, rising from the edge: gray-100, top r24. The
      // handle only shows where a sheet asks for one (many draw their own).
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: raised.gray100,
        modalBackgroundColor: raised.gray100,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        modalElevation: 0,
        modalBarrierColor: _barrier,
        clipBehavior: Clip.antiAlias,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(V15.dialogRadius),
          ),
        ),
        dragHandleColor: raised.gray300,
        dragHandleSize: const Size(40, 6),
      ),

      // Dialog as a tray: gray-100, r24, a 5% ring; black/40 behind.
      dialogTheme: DialogThemeData(
        backgroundColor: raised.gray100,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        barrierColor: _barrier,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        shape: RoundedRectangleBorder(
          borderRadius: _r24,
          side: BorderSide(color: c.ringPanel),
        ),
        titleTextStyle: _t(
          17,
          FontWeight.w500,
          ink,
          height: 1.25,
          tight: true,
        ),
        contentTextStyle: _t(14, FontWeight.w400, c.gray600, height: 20 / 14),
        iconColor: c.gray700,
      ),

      // A white sheet: r14, hairline ring, flat.
      cardTheme: CardThemeData(
        color: c.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: _r14,
          side: BorderSide(color: c.hairline),
        ),
      ),

      // FilterChip: idle gray-100 / gray-700, active primary-light / primary.
      // Padding keeps today's footprint so fixed-height chip rows still fit.
      chipTheme: ChipThemeData(
        backgroundColor: c.gray100,
        selectedColor: c.primaryLight,
        disabledColor: c.gray100.withValues(alpha: 0.4),
        side: BorderSide.none,
        shape: const RoundedRectangleBorder(borderRadius: _r12),
        labelStyle: _t(
          14,
          FontWeight.w500,
          WidgetStateColor.resolveWith((s) {
            if (s.contains(WidgetState.disabled)) return c.gray400;
            if (s.contains(WidgetState.selected)) return c.primaryInk;
            return c.gray700;
          }),
        ),
        secondaryLabelStyle: _t(14, FontWeight.w500, c.primaryInk),
        checkmarkColor: c.primaryInk,
        deleteIconColor: c.gray500,
        iconTheme: IconThemeData(color: c.gray700, size: 16),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        elevation: 0,
        pressElevation: 0,
        shadowColor: Colors.transparent,
        selectedShadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        brightness: brightness,
      ),

      // Unchecked: white with a gray-300 edge; checked: the brand colour.
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) {
          if (s.contains(WidgetState.disabled) &&
              !s.contains(WidgetState.selected)) {
            return c.surface.withValues(alpha: 0.6);
          }
          return Colors.white;
        }),
        trackColor: WidgetStateProperty.resolveWith((s) {
          final on = s.contains(WidgetState.selected);
          final color = on ? c.primary : c.gray300;
          return s.contains(WidgetState.disabled)
              ? color.withValues(alpha: 0.4)
              : color;
        }),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) {
          if (!s.contains(WidgetState.selected)) return c.surface;
          return s.contains(WidgetState.disabled)
              ? c.primary.withValues(alpha: 0.4)
              : c.primary;
        }),
        checkColor: WidgetStatePropertyAll(c.onPrimary),
        side: WidgetStateBorderSide.resolveWith(
          (s) => BorderSide(
            color: s.contains(WidgetState.selected) ? c.primary : c.gray300,
            width: 1.5,
          ),
        ),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(6))),
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) {
          final color = s.contains(WidgetState.selected) ? c.primary : c.gray300;
          return s.contains(WidgetState.disabled)
              ? color.withValues(alpha: 0.4)
              : color;
        }),
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      ),

      // Separate with shade: dividers are the faintest grey.
      dividerTheme: DividerThemeData(
        color: c.divider,
        thickness: 1,
        space: 1,
      ),

      // Rows px16 py12; title = card heading, subtitle = description.
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        minVerticalPadding: 12,
        shape: const RoundedRectangleBorder(borderRadius: _r12),
        iconColor: c.gray700,
        textColor: ink,
        selectedColor: ink,
        selectedTileColor: c.gray100,
        titleTextStyle: _t(15, FontWeight.w500, ink),
        subtitleTextStyle: _t(
          13,
          FontWeight.w400,
          c.gray500,
          height: 20 / 13,
        ),
        leadingAndTrailingTextStyle: _t(
          14,
          FontWeight.w400,
          c.gray500,
          tabular: true,
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? raised.surface : c.gray900,
        contentTextStyle: _t(
          14,
          FontWeight.w500,
          isDark ? c.gray900 : Colors.white,
        ),
        actionTextColor: isDark ? c.primary : c.primaryLight,
        closeIconColor: isDark ? c.gray500 : c.gray400,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: _r12,
          side: isDark ? BorderSide(color: c.ringPanel) : BorderSide.none,
        ),
      ),

      // Segmented: a gray-100 track whose 3px edge and gaps frame a white
      // thumb on the selected segment.
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? c.surface : c.gray100,
          ),
          foregroundColor: WidgetStateProperty.resolveWith((s) {
            if (s.contains(WidgetState.disabled)) return c.gray400;
            return s.contains(WidgetState.selected) ? ink : c.gray500;
          }),
          iconColor: WidgetStateProperty.resolveWith((s) {
            if (s.contains(WidgetState.disabled)) return c.gray400;
            return s.contains(WidgetState.selected) ? ink : c.gray500;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
          shadowColor: const WidgetStatePropertyAll(Colors.transparent),
          elevation: const WidgetStatePropertyAll(0),
          side: WidgetStatePropertyAll(BorderSide(color: c.gray100, width: 3)),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: _r12),
          ),
          textStyle: const WidgetStatePropertyAll(_buttonText),
          iconSize: const WidgetStatePropertyAll(16),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 14),
          ),
        ),
      ),

      // Nav: a grey tray, the active item a white key; ink when active.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.gray100,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        indicatorColor: c.surface,
        indicatorShape: const RoundedRectangleBorder(borderRadius: _r12),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: 22,
            color: s.contains(WidgetState.selected) ? ink : c.gray500,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => _t(
            12,
            FontWeight.w500,
            s.contains(WidgetState.selected) ? ink : c.gray500,
          ),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: c.page,
        selectedItemColor: ink,
        unselectedItemColor: c.gray400,
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: _t(11, FontWeight.w500, null),
        unselectedLabelStyle: _t(11, FontWeight.w500, null),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: ink,
        unselectedLabelColor: c.gray500,
        labelStyle: _t(14, FontWeight.w500, null),
        unselectedLabelStyle: _t(14, FontWeight.w500, null),
        indicatorColor: ink,
        dividerColor: c.divider,
        dividerHeight: 1,
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        splashFactory: NoSplash.splashFactory,
      ),

      // Neutral spinners (pending reads are skeletons; this is the rest).
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: ink,
        linearTrackColor: c.gray100,
        circularTrackColor: Colors.transparent,
        refreshBackgroundColor: c.surface,
      ),

      popupMenuTheme: PopupMenuThemeData(
        color: raised.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: _menuShadow,
        elevation: 8,
        menuPadding: const EdgeInsets.symmetric(vertical: 4),
        shape: RoundedRectangleBorder(
          borderRadius: _r14,
          side: BorderSide(color: c.ringPanel),
        ),
        textStyle: _t(14, FontWeight.w400, ink),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => _t(
            14,
            FontWeight.w400,
            s.contains(WidgetState.disabled) ? c.gray400 : ink,
          ),
        ),
        iconColor: c.gray700,
        iconSize: 18,
      ),
      menuTheme: MenuThemeData(style: menuStyle),
      dropdownMenuTheme: DropdownMenuThemeData(
        menuStyle: menuStyle,
        textStyle: _t(15, FontWeight.w400, ink),
      ),

      datePickerTheme: DatePickerThemeData(
        backgroundColor: raised.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: _r24),
      ),
      timePickerTheme: TimePickerThemeData(
        backgroundColor: raised.surface,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: _r24),
      ),

      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(color: c.gray900, borderRadius: _r8),
        textStyle: _t(12, FontWeight.w500, c.surface),
      ),
    );
  }
}
