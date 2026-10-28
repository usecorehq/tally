import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/core/utils/naira.dart';

void main() {
  test('formatNaira groups thousands and keeps kobo only when present', () {
    expect(formatNaira('45000'), '₦45,000');
    expect(formatNaira('45000.00'), '₦45,000');
    expect(formatNaira('2500.50'), '₦2,500.50');
    expect(formatNaira('2500.5'), '₦2,500.50');
    expect(formatNaira('300'), '₦300');
    expect(formatNaira('1234567.89'), '₦1,234,567.89');
  });

  test('formatQuantity drops trailing zeros', () {
    expect(formatQuantity('12.000'), '12');
    expect(formatQuantity('2.500'), '2.5');
    expect(formatQuantity('7'), '7');
  });
}
