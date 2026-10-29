import 'dart:math' as math;

import 'package:flutter/painting.dart';

/// One brand palette a business can pick as its accent colour — web
/// `@qorelly/shared/themes`. The id is what `businesses.theme_color` stores
/// and what the public storefront renders, so ids and hexes must stay
/// byte-for-byte with web: a drifted copy here meant mobile wrote 'indigo'
/// (a value web and the storefront don't know, so they fell back to purple)
/// and drew every swatch in a different shade from what customers see.
class BrandTheme {
  final String id;
  final String name;
  final Color primary;
  final String hex;

  const BrandTheme(this.id, this.name, this.primary, this.hex);
}

/// Web `themes`, in web's order.
const List<BrandTheme> kBrandThemes = [
  BrandTheme('blue', 'Ocean Blue', Color(0xFF1D9BF0), '#1D9BF0'),
  BrandTheme('yellow', 'Sunshine Yellow', Color(0xFFFFD400), '#FFD400'),
  BrandTheme('pink', 'Hot Pink', Color(0xFFF91880), '#F91880'),
  BrandTheme('purple', 'Royal Purple', Color(0xFF7856FF), '#7856FF'),
  BrandTheme('orange', 'Vibrant Orange', Color(0xFFFF7A00), '#FF7A00'),
  BrandTheme('green', 'Fresh Green', Color(0xFF00BA7C), '#00BA7C'),
];

/// Web DEFAULT_THEME_ID.
const String kDefaultBrandThemeId = 'purple';

BrandTheme brandThemeById(String id) => kBrandThemes.firstWhere(
      (t) => t.id == id,
      orElse: () => kBrandThemes.firstWhere((t) => t.id == kDefaultBrandThemeId),
    );

/// Web `resolveThemeId`: a known id as-is, anything else (missing, retired,
/// a hex) the default.
String resolveBrandThemeId(String? value) =>
    value != null && kBrandThemes.any((t) => t.id == value)
        ? value
        : kDefaultBrandThemeId;

final _hexPattern = RegExp(r'^#[0-9a-fA-F]{6}$');

/// Web SettingsAppearancePage `toThemeId`: `theme_color` is shared with the
/// Menu Builder, which saves a brand hex (`#FF0026`) rather than a theme id.
/// A hex maps to the nearest theme (RGB distance) so the picker shows a
/// sensible selection instead of none.
String nearestBrandThemeId(String? value) {
  if (value == null || !_hexPattern.hasMatch(value)) {
    return resolveBrandThemeId(value);
  }
  List<int> rgb(String hex) {
    final n = int.parse(hex.substring(1), radix: 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  final c = rgb(value);
  var best = resolveBrandThemeId(null);
  var bestDist = double.infinity;
  for (final t in kBrandThemes) {
    final p = rgb(t.hex);
    final d = ((c[0] - p[0]) * (c[0] - p[0]) +
            (c[1] - p[1]) * (c[1] - p[1]) +
            (c[2] - p[2]) * (c[2] - p[2]))
        .toDouble();
    if (d < bestDist) {
      best = t.id;
      bestDist = d;
    }
  }
  return best;
}

/// Web AppearanceV2 `onColor`: white or near-black, whichever reads on
/// [color] (Sunshine Yellow needs dark text).
Color onBrandColor(Color color) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  final l = 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
  return l > 0.45 ? const Color(0xFF111827) : const Color(0xFFFFFFFF);
}
