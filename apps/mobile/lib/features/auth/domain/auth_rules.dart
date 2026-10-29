/// Sign-up / sign-in rules — copied unchanged from qorelly-mobile
/// lib/core/auth/auth_rules.dart (re-copy to update) so Tally rejects exactly
/// what Qorelly rejects on the same shared accounts.
///
/// Each block mirrors one web file in qorelly `apps/mp/src/lib` so the app
/// rejects exactly what the merchant portal rejects, with the same copy:
///   passwordPolicy.ts, blockedEmailDomains.ts, emailValidation.ts,
///   referral.ts, authOtp.ts (+ packages/shared/src/authOtp.ts),
///   VerifyOtpPage.tsx `safeNext`.
/// GoTrue (and the handle_new_user trigger) stay the authority — these checks
/// only spare the round trip.
library;

// ─── Password (passwordPolicy.ts) ───────────────────────────────────────────

/// GoTrue's minimum. Raise both together if the server setting changes.
const int kPasswordMinLength = 6;

const String kPasswordTooShortError =
    'Password must be at least $kPasswordMinLength characters';

const String kPasswordPlaceholder = 'At least $kPasswordMinLength characters';

bool isPasswordLongEnough(String password) =>
    password.length >= kPasswordMinLength;

// ─── Disposable email domains (blockedEmailDomains.ts) ─────────────────────

/// Keep in sync with packages/shared/src/blockedEmailDomains.ts.
const List<String> kBlockedEmailDomains = [
  'ethereal.email',
  'yopmail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  '10minutemail.com',
  'throwawaymail.com',
  'emailondeck.com',
  'fakemail.net',
  'mohmal.com',
  'mytemp.email',
  'tempinbox.com',
  'getnada.com',
  'burnermail.io',
  'trashmail.com',
  'maildrop.cc',
  'mintemail.com',
  'tempail.com',
  'dispostable.com',
  'dropmail.me',
  'owlymail.com',
  'tmail.io',
  'mail1.io',
  'hottempmail.com',
  'fakemailgenerator.com',
  'jetable.org',
  'mail.tm',
  'harakirimail.com',
  'tempm.com',
  'boun.cr',
  'relay.firefox.com',
  'blur.abine.com',
  'simplelogin.io',
  'duck.com',
  'moakt.com',
  'fakeinbox.com',
  '33mail.com',
  'mytrashmail.com',
  'yolamail.com',
  'temp-mail.io',
  'emailthetemp.com',
  'mailhero.io',
  'eligou.com',
];

final Set<String> _blockedDomains = kBlockedEmailDomains.toSet();

const String kDisposableEmailError =
    'Disposable email addresses are not allowed. Please use a real email.';

String? emailDomain(String email) {
  final at = email.lastIndexOf('@');
  if (at == -1 || at == email.length - 1) return null;
  return email.substring(at + 1).trim().toLowerCase();
}

bool isDisposableEmail(String email) {
  final domain = emailDomain(email);
  return domain != null && _blockedDomains.contains(domain);
}

// ─── Email shape + name (emailValidation.ts) ───────────────────────────────

const String _localAtom = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const String _domainLabel = r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';

final RegExp kEmailShapePattern = RegExp(
  '^$_localAtom(?:\\.$_localAtom)*@(?:$_domainLabel\\.)+[A-Za-z]{2,63}\$',
);

const String kEmailShapeError =
    'Enter a valid email address, like you@business.com.';

const String kNameRequiredError = 'Please enter your full name.';

/// Trim + lowercase. Apply before validating and before handing to Supabase.
String normalizeEmail(String? raw) => (raw ?? '').trim().toLowerCase();

/// Shape only — the disposable-domain list is a separate check. Rejects
/// `you@me` and `you@resturant`, which GoTrue accepts but can never receive
/// a code.
bool isValidEmailShape(String email) {
  if (email.isEmpty || email.length > 254) return false;
  final at = email.lastIndexOf('@');
  if (at < 1 || at > 64) return false;
  return kEmailShapePattern.hasMatch(email);
}

/// Collapse internal runs of whitespace and trim; '' when nothing is left.
String normalizeName(String? raw) =>
    (raw ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();

// ─── Referral code (referral.ts) ────────────────────────────────────────────

/// Mirrors the DB CHECK on referrers.code.
final RegExp kReferralCodePattern = RegExp(r'^[A-Z0-9][A-Z0-9-]{2,31}$');

String normalizeReferralCode(String raw) =>
    raw.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9-]'), '');

/// The code to stamp into signup metadata, or null. A malformed code is
/// dropped, never rejected — it must not block someone creating an account
/// (same rule as /api/auth/signup).
String? referralCodeForMetadata(String? raw) {
  if (raw == null) return null;
  final code = normalizeReferralCode(raw);
  return kReferralCodePattern.hasMatch(code) ? code : null;
}

// ─── Email OTP (authOtp.ts) ─────────────────────────────────────────────────

const int kAuthOtpDefaultLength = 6;
const int kAuthOtpMinLength = 4;
const int kAuthOtpMaxLength = 10;

/// Digits the code field renders. Must match the supabase-auth container's
/// GOTRUE_MAILER_OTP_LENGTH (web: VITE_AUTH_OTP_LENGTH); override with
/// `--dart-define=AUTH_OTP_LENGTH=8` if the server changes.
final int kAuthOtpLength = resolveOtpLength(
  const String.fromEnvironment('AUTH_OTP_LENGTH'),
);

/// Falls back rather than throwing: a bad value must not break sign-in.
int resolveOtpLength(String? raw) {
  final parsed = int.tryParse(raw ?? '');
  return parsed != null &&
          parsed >= kAuthOtpMinLength &&
          parsed <= kAuthOtpMaxLength
      ? parsed
      : kAuthOtpDefaultLength;
}

/// Strip non-digits, capped at the widest code GoTrue can mint.
String normalizeOtp(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  return digits.length > kAuthOtpMaxLength
      ? digits.substring(0, kAuthOtpMaxLength)
      : digits;
}

/// Length-tolerant on purpose: GoTrue judges the code, not us.
bool isPlausibleOtp(String code) =>
    code.length >= kAuthOtpMinLength && code.length <= kAuthOtpMaxLength;

/// How long a code lives (GOTRUE_MAILER_OTP_EXP). Drives the Resend countdown.
const int kOtpExpirySeconds = 300;

String formatOtpCountdown(int seconds) {
  final m = seconds ~/ 60;
  final s = seconds % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

/// In-app destination after verifying, honoured only as a relative path —
/// never an absolute URL or a protocol-relative `//host`.
String? safeNextPath(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}
