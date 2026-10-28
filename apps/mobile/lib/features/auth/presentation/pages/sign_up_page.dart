import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../domain/auth_rules.dart';
import '../../domain/phone.dart';
import '../cubit/account_cubits.dart';
import 'auth_flow.dart';
import 'verify_code_page.dart';

/// A new shared Qorelly account (same rules and metadata as Qorelly's own
/// sign-up), then the emailed code.
class SignUpPage extends StatelessWidget {
  const SignUpPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(create: (_) => sl<SignUpCubit>(), child: const _SignUpView());
  }
}

class _SignUpView extends StatefulWidget {
  const _SignUpView();

  @override
  State<_SignUpView> createState() => _SignUpViewState();
}

class _SignUpViewState extends State<_SignUpView> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _obscured = true;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    context.read<SignUpCubit>().submit(
      fullName: _name.text,
      email: _email.text,
      phone: _phone.text,
      password: _password.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<SignUpCubit, AuthFormState>(
      listener: (context, state) {
        if (state.status != AuthFormStatus.done) return;
        if (state.user != null) {
          finishSignIn(context, state.user);
        } else {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute<void>(builder: (_) => VerifyCodePage(email: normalizeEmail(_email.text), recovery: false)),
          );
        }
      },
      builder: (context, state) => AuthScaffold(
        child: AuthCard(
          footer: AuthFooterLine(
            prompt: 'Already have an account? ',
            action: 'Sign in',
            onTap: () => Navigator.of(context).maybePop(),
          ),
          children: [
            const AuthHeading(
              title: 'Create your account',
              subtitle: 'One Qorelly account for Tally and Qorelly',
            ),
            const SizedBox(height: 24),
            AutofillGroup(
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (state.error != null) ...[AuthMessage(state.error!), const SizedBox(height: 16)],
                    AuthField(
                      label: 'Full name',
                      hint: 'Adaeze Okafor',
                      controller: _name,
                      icon: IconsOutline.user,
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      validator: (v) => normalizeName(v).isEmpty ? kNameRequiredError : null,
                    ),
                    const SizedBox(height: 16),
                    AuthField(
                      label: 'Email',
                      hint: 'you@business.com',
                      controller: _email,
                      icon: IconsOutline.letter,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      validator: (v) {
                        final email = normalizeEmail(v);
                        if (!isValidEmailShape(email)) return kEmailShapeError;
                        return isDisposableEmail(email) ? kDisposableEmailError : null;
                      },
                    ),
                    const SizedBox(height: 16),
                    AuthField(
                      label: 'Phone',
                      hint: kNigeria.example,
                      controller: _phone,
                      icon: IconsOutline.phone,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      validator: (v) {
                        if ((v ?? '').trim().isEmpty) return kPhoneRequiredError;
                        return isValidPhone(v) ? null : kPhoneShapeError;
                      },
                    ),
                    const SizedBox(height: 16),
                    AuthField(
                      label: 'Password',
                      hint: kPasswordPlaceholder,
                      controller: _password,
                      icon: IconsOutline.lock_keyhole_minimalistic,
                      obscureText: _obscured,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.newPassword],
                      onSubmitted: (_) => _submit(),
                      suffix: AuthPasswordToggle(
                        obscured: _obscured,
                        onPressed: () => setState(() => _obscured = !_obscured),
                      ),
                      validator: (v) => isPasswordLongEnough(v ?? '') ? null : kPasswordTooShortError,
                    ),
                    const SizedBox(height: 24),
                    V15Button(
                      'Create account',
                      height: 48,
                      expand: true,
                      loading: state.submitting,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
