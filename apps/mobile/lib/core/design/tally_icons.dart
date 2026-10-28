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
  static const IconData alt_arrow_left = IconData(0xe01a, fontFamily: _light); // caret-left
  static const IconData arrow_left = IconData(0xe003, fontFamily: _light); // arrow-left
  static const IconData buildings = IconData(0xe014, fontFamily: _light); // buildings
  static const IconData chef_hat = IconData(0xe028, fontFamily: _light); // chef-hat
  static const IconData clock_circle = IconData(0xe02b, fontFamily: _light); // clock
  static const IconData delivery = IconData(0xe0a6, fontFamily: _light); // truck
  static const IconData document = IconData(0xe042, fontFamily: _light); // file
  static const IconData eye = IconData(0xe040, fontFamily: _light); // eye
  static const IconData eye_closed = IconData(0xe041, fontFamily: _light); // eye-closed
  static const IconData info_circle = IconData(0xe056, fontFamily: _light); // info
  static const IconData letter = IconData(0xe03e, fontFamily: _light); // envelope-simple
  static const IconData lock_keyhole_minimalistic = IconData(0xe063, fontFamily: _light); // lock-key
  static const IconData mirror = IconData(0xe046, fontFamily: _light); // flower-lotus
  static const IconData phone = IconData(0xe078, fontFamily: _light); // phone
  static const IconData pills = IconData(0xe079, fontFamily: _light); // pill
  static const IconData shop = IconData(0xe098, fontFamily: _light); // storefront
  static const IconData widget_5 = IconData(0xe094, fontFamily: _light); // squares-four
  static const IconData alt_arrow_right = IconData(0xe01b, fontFamily: _light); // caret-right
  static const IconData box = IconData(0xe070, fontFamily: _light); // package
  static const IconData camera = IconData(0xe018, fontFamily: _light); // camera
  static const IconData check = IconData(0xe025, fontFamily: _light); // check
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

/// Phosphor Fill: the selected / active state only (the active tab, a picked option).
class IconsFill {
  IconsFill._();

  static const String _fontFamily = 'PhosphorFill';

  static const IconData box = IconData(0xe070, fontFamily: _fontFamily); // package
  static const IconData buildings = IconData(0xe014, fontFamily: _fontFamily); // buildings
  static const IconData chef_hat = IconData(0xe028, fontFamily: _fontFamily); // chef-hat
  static const IconData delivery = IconData(0xe0a6, fontFamily: _fontFamily); // truck
  static const IconData document = IconData(0xe042, fontFamily: _fontFamily); // file
  static const IconData mirror = IconData(0xe046, fontFamily: _fontFamily); // flower-lotus
  static const IconData pills = IconData(0xe079, fontFamily: _fontFamily); // pill
  static const IconData shop = IconData(0xe098, fontFamily: _fontFamily); // storefront
  static const IconData widget_5 = IconData(0xe094, fontFamily: _fontFamily); // squares-four
  static const IconData history = IconData(0xe02d, fontFamily: _fontFamily); // clock-counter-clockwise
  static const IconData settings = IconData(0xe04c, fontFamily: _fontFamily); // gear
}
