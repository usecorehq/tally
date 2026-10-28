/// Same rule as apps/api: a 12-digit UPC-A is the 13-digit EAN with a leading
/// zero, and scanners return either, so 12-digit codes become 13.
String normalizeBarcode(String code) {
  final trimmed = code.trim();
  return RegExp(r'^\d{12}$').hasMatch(trimmed) ? '0$trimmed' : trimmed;
}
