import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/features/inventory/domain/barcode.dart';

void main() {
  test('a 12-digit UPC-A becomes the 13-digit EAN (same rule as the API)', () {
    expect(normalizeBarcode('036000291452'), '0036000291452');
  });

  test('other codes are only trimmed', () {
    expect(normalizeBarcode(' 6156000024013 '), '6156000024013');
    expect(normalizeBarcode('96385074'), '96385074');
    expect(normalizeBarcode('ABC-123'), 'ABC-123');
  });
}
