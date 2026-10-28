import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../domain/auth_rules.dart';
import '../cubit/account_cubits.dart';
import 'auth_flow.dart';
import 'new_password_page.dart';

/// The emailed code — confirms a sign-up, or ([recovery]) starts a password
/// reset. A code was just sent when this opens.
class VerifyCodePage extends StatelessWidget {
  const VerifyCodePage({super.key, required this.email, required this.recovery});
  final String email;
  final bool recovery;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<VerifyCodeCubit>(param1: email, param2: recovery),
      child: _VerifyCodeView(email: email, recovery: recovery),
    );
  }
}

class _VerifyCodeView extends StatefulWidget {
  const _VerifyCodeView({required this.email, required this.recovery});
  final String email;
  final bool recovery;

  @override
  State<_VerifyCodeView> createState() => _VerifyCodeViewState();
}

class _VerifyCodeViewState extends State<_VerifyCodeView> {
  /// Wait between resends, as Qorelly's code screen.
  static const _resendAfter = 60;

  final _code = TextEditingController();
  Timer? _timer;
  int _wait = _resendAfter;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() => _wait = _resendAfter);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_wait <= 1) t.cancel();
      setState(() => _wait--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _verify() => context.read<VerifyCodeCubit>().verify(_code.text);

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return BlocConsumer<VerifyCodeCubit, AuthFormState>(
      listener: (context, state) {
        if (state.notice != null) _startCountdown();
        if (state.status != AuthFormStatus.done) return;
        if (widget.recovery) {
          Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const NewPasswordPage()));
        } else {
          finishSignIn(context, state.user);
        }
      },
      builder: (context, state) => AuthScaffold(
        child: AuthCard(
          children: [
            AuthHeading(
              title: 'Check your email',
              subtitle:
                  'We sent a $kAuthOtpLength-digit code to ${widget.email}. '
                  '${widget.recovery ? 'Enter it to choose a new password.' : 'Enter it to confirm your account.'}',
            ),
            const SizedBox(height: 24),
            if (state.error != null) ...[AuthMessage(state.error!), const SizedBox(height: 16)],
            if (state.notice != null) ...[
              AuthMessage(state.notice!, tone: AuthTone.success),
              const SizedBox(height: 16),
            ],
            TextField(
              controller: _code,
              autofocus: true,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(kAuthOtpMaxLength)],
              onChanged: (v) {
                if (v.length == kAuthOtpLength) _verify();
              },
              style: V15.text(24, FontWeight.w600, c.gray900, tabular: true).copyWith(letterSpacing: 8),
              decoration: InputDecoration(hintText: '•' * kAuthOtpLength),
            ),
            const SizedBox(height: 16),
            V15Button('Continue', height: 48, expand: true, loading: state.submitting, onPressed: _verify),
            const SizedBox(height: 8),
            Center(
              child: AuthTextAction(
                _wait > 0 ? 'Send a new code in ${formatOtpCountdown(_wait)}' : 'Send a new code',
                quiet: _wait > 0,
                onTap: _wait > 0 || state.submitting ? null : () => context.read<VerifyCodeCubit>().resend(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
