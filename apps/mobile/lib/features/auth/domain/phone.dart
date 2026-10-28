/// Copied unchanged from qorelly-mobile lib/core/utils/phone.dart (re-copy to
/// update).
///
/// Account phone-number normalisation — a port of qorelly
/// `packages/shared/src/phone.ts` (mp keeps a copy at `apps/mp/src/lib/phone.ts`).
/// Keep the three in sync.
///
/// NOT a full E.164 parser: it knows the dial codes and national lengths of
/// the markets we sell in, which is enough to turn whatever a merchant types
/// into one canonical E.164 string (the shape the `user_profiles.phone` CHECK
/// enforces, migration 20260905000004) or reject it.
///
/// Accepts (all → +2348031234567, default country NG):
///   0803 123 4567, 08031234567, +234 803 123 4567, 234 803 123 4567,
///   (0803) 123-4567; any listed country when the '+' is present.
/// Rejects: too short, wrong national length, unknown dial code, empty.
library;

class PhoneCountry {
  final String code;
  final String name;

  /// Dial code WITH the leading '+'.
  final String dial;

  /// Plausible national-number lengths (digits after the dial code).
  final List<int> lengths;
  final String example;

  const PhoneCountry({
    required this.code,
    required this.name,
    required this.dial,
    required this.lengths,
    required this.example,
  });

  String get dialDigits => dial.substring(1);
}

const PhoneCountry kNigeria = PhoneCountry(
  code: 'NG',
  name: 'Nigeria',
  dial: '+234',
  lengths: [10],
  example: '0803 123 4567',
);

/// Markets we operate in first, then the common diaspora ones.
const List<PhoneCountry> kPhoneCountries = [
  kNigeria,
  PhoneCountry(
      code: 'GH', name: 'Ghana', dial: '+233', lengths: [9],
      example: '024 123 4567'),
  PhoneCountry(
      code: 'KE', name: 'Kenya', dial: '+254', lengths: [9],
      example: '0712 345 678'),
  PhoneCountry(
      code: 'ZA', name: 'South Africa', dial: '+27', lengths: [9],
      example: '082 123 4567'),
  PhoneCountry(
      code: 'EG', name: 'Egypt', dial: '+20', lengths: [10],
      example: '010 1234 5678'),
  PhoneCountry(
      code: 'GB', name: 'United Kingdom', dial: '+44', lengths: [10],
      example: '07400 123456'),
  PhoneCountry(
      code: 'US', name: 'United States', dial: '+1', lengths: [10],
      example: '415 555 0123'),
  PhoneCountry(
      code: 'CA', name: 'Canada', dial: '+1', lengths: [10],
      example: '416 555 0123'),
];

const PhoneCountry kDefaultPhoneCountry = kNigeria;

const String kPhoneRequiredError = 'Please enter your phone number.';
const String kPhoneShapeError =
    'Enter a valid phone number, like 0803 123 4567 or +234 803 123 4567.';
const String kPhoneHint =
    'Nigerian numbers can start with 0 or +234; other countries need the + code.';

/// The shape the database CHECK enforces.
final RegExp kE164Pattern = RegExp(r'^\+[1-9][0-9]{7,14}$');

String? _buildE164(String dial, String national, PhoneCountry country) {
  if (!country.lengths.contains(national.length)) return null;
  final e164 = '+$dial$national';
  return kE164Pattern.hasMatch(e164) ? e164 : null;
}

List<PhoneCountry> _byLongestDial(Iterable<PhoneCountry> countries) =>
    countries.toList()
      ..sort((a, b) => b.dialDigits.length.compareTo(a.dialDigits.length));

/// Normalise free text to E.164, or null when it can't be read as a number
/// for any listed country.
String? normalizePhoneE164(
  String? raw, {
  PhoneCountry defaultCountry = kDefaultPhoneCountry,
}) {
  if (raw == null) return null;
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return null;

  // 1. International with '+': longest matching dial code wins.
  if (trimmed.startsWith('+')) {
    final candidates = _byLongestDial(
        kPhoneCountries.where((c) => digits.startsWith(c.dialDigits)));
    for (final c in candidates) {
      final hit =
          _buildE164(c.dialDigits, digits.substring(c.dialDigits.length), c);
      if (hit != null) return hit;
    }
    return null;
  }

  // 2. Bare country code without '+', only when the remainder is a plausible
  //    national number for that country.
  for (final c in [defaultCountry, ...kPhoneCountries]) {
    final d = c.dialDigits;
    if (digits.length > d.length && digits.startsWith(d)) {
      final hit = _buildE164(d, digits.substring(d.length), c);
      if (hit != null) return hit;
    }
  }

  // 3. National format for the default country: drop the trunk '0'.
  return _buildE164(
    defaultCountry.dialDigits,
    digits.replaceFirst(RegExp(r'^0+'), ''),
    defaultCountry,
  );
}

bool isValidPhone(String? raw) => normalizePhoneE164(raw) != null;

/// Display helper: +2348031234567 → +234 803 123 4567 (best effort).
String formatPhoneForDisplay(String? e164) {
  if (e164 == null || !kE164Pattern.hasMatch(e164)) return e164 ?? '';
  final digits = e164.substring(1);
  final matches = _byLongestDial(
      kPhoneCountries.where((c) => digits.startsWith(c.dialDigits)));
  if (matches.isEmpty) return e164;
  final country = matches.first;
  final national = digits.substring(country.dialDigits.length);
  final groups = national.length == 10
      ? [
          national.substring(0, 3),
          national.substring(3, 6),
          national.substring(6),
        ]
      : [national.substring(0, 3), national.substring(3)];
  return '${country.dial} ${groups.join(' ')}';
}
