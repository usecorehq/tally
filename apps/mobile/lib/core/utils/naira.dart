/// `"2500.50"` → `₦2,500.50`, `"45000"` → `₦45,000`. Works on the API's string
/// amounts so money never passes through a double.
String formatNaira(String amount) {
  final parts = amount.split('.');
  final whole = parts[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  final kobo = parts.length > 1 ? parts[1].padRight(2, '0').substring(0, 2) : '00';
  return kobo == '00' ? '₦$whole' : '₦$whole.$kobo';
}

/// `"12.000"` → `12`, `"2.500"` → `2.5`.
String formatQuantity(String quantity) {
  if (!quantity.contains('.')) return quantity;
  final trimmed = quantity.replaceFirst(RegExp(r'0+$'), '');
  return trimmed.endsWith('.') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
}
