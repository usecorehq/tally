import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../domain/auth_rules.dart';
import '../cubit/sign_in_cubit.dart';
import 'auth_flow.dart';
import 'forgot_password_page.dart';
import 'sign_up_page.dart';
import 'verify_code_page.dart';

class SignInPage extends StatelessWidget {
  const SignInPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(create: (_) => sl<SignInCubit>(), child: const _SignInView());
  }
}

class _SignInView extends StatefulWidget {
  const _SignInView();

  @override
  State<_SignInView> createState() => _SignInViewState();
}

class _SignInViewState extends State<_SignInView> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscured = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    context.read<SignInCubit>().submit(email: _email.text, password: _password.text);
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<SignInCubit, SignInState>(
      listener: (context, state) {
        if (state.status == SignInStatus.success) finishSignIn(context, state.user);
        if (state.status == SignInStatus.unconfirmed) {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => VerifyCodePage(email: normalizeEmail(_email.text), recovery: false),
            ),
          );
        }
      },
      builder: (context, state) {
        final submitting = state.status == SignInStatus.submitting;
        return AuthScaffold(
          child: AuthCard(
            footer: AuthFooterLine(
              prompt: 'New to Tally? ',
              action: 'Create an account',
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SignUpPage())),
            ),
            children: [
              const AuthHeading(title: 'Welcome back', subtitle: 'Sign in with your Qorelly account'),
              const SizedBox(height: 24),
              AutofillGroup(
                child: Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (state.status == SignInStatus.failure && state.error != null) ...[
                        AuthMessage(state.error!),
                        const SizedBox(height: 16),
                      ],
                      AuthField(
                        label: 'Email',
                        hint: 'you@business.com',
                        controller: _email,
                        icon: IconsOutline.letter,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.email],
                        validator: (v) => isValidEmailShape(normalizeEmail(v)) ? null : kEmailShapeError,
                      ),
                      const SizedBox(height: 16),
                      AuthField(
                        label: 'Password',
                        hint: '••••••••',
                        controller: _password,
                        icon: IconsOutline.lock_keyhole_minimalistic,
                        obscureText: _obscured,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => _submit(),
                        suffix: AuthPasswordToggle(
                          obscured: _obscured,
                          onPressed: () => setState(() => _obscured = !_obscured),
                        ),
                        validator: (v) => (v ?? '').isEmpty ? 'Enter your password.' : null,
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: AuthTextAction(
                          'Forgot password?',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => ForgotPasswordPage(email: normalizeEmail(_email.text)),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      V15Button('Sign in', height: 48, expand: true, loading: submitting, onPressed: _submit),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
