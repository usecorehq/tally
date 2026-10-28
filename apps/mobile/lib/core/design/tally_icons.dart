// ignore_for_file: constant_identifier_names

import 'package:flutter/widgets.dart';

// The Phosphor glyphs Tally uses, under qorelly-mobile's IconsOutline /
// IconsFill names (lib/core/icons there) so screens port across unchanged.
// Fonts: assets/fonts/phosphor (MIT, see LICENSE there). Add a glyph by
// copying its line from qorelly-mobile's generated icon files.

/// Phosphor Light: every idle glyph.
class IconsOutline {
  IconsOutline._();

  static const String _light = 'PhosphorLight';
  static const String _fill = 'PhosphorFill';

  static const IconData add_circle = IconData(0xe07b, fontFamily: _light); // plus
  static const IconData alt_arrow_right = IconData(0xe01b, fontFamily: _light); // caret-right
  static const IconData box = IconData(0xe070, fontFamily: _light); // package
  static const IconData camera = IconData(0xe018, fontFamily: _light); // camera
  static const IconData check_circle = IconData(0xe026, fontFamily: _fill); // check-circle
  static const IconData close_circle = IconData(0xe0b4, fontFamily: _light); // x
  static const IconData danger_circle = IconData(0xe0b1, fontFamily: _light); // warning-circle
  static const IconData gallery = IconData(0xe055, fontFamily: _light); // image
  static const IconData history = IconData(0xe02d, fontFamily: _light); // clock-counter-clockwise
  static const IconData logout = IconData(0xe08f, fontFamily: _light); // sign-out
  static const IconData magnifer = IconData(0xe065, fontFamily: _light); // magnifying-glass
  static const IconData refresh = IconData(0xe008, fontFamily: _light); // arrows-clockwise
  static const IconData scanner = IconData(0xe00c, fontFamily: _light); // barcode
  static const IconData settings = IconData(0xe04c, fontFamily: _light); // gear
  static const IconData stars = IconData(0xe091, fontFamily: _light); // sparkle
  static const IconData user = IconData(0xe0a8, fontFamily: _light); // user
}

/// Phosphor Fill: the selected / active state only (the active tab).
class IconsFill {
  IconsFill._();

  static const String _fontFamily = 'PhosphorFill';

  static const IconData box = IconData(0xe070, fontFamily: _fontFamily); // package
  static const IconData history = IconData(0xe02d, fontFamily: _fontFamily); // clock-counter-clockwise
  static const IconData settings = IconData(0xe04c, fontFamily: _fontFamily); // gear
}
