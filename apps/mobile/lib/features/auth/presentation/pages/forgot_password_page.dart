import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../domain/auth_rules.dart';
import '../cubit/account_cubits.dart';
import 'verify_code_page.dart';

/// Email a reset code, then the code screen, then a new password.
class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key, this.email = ''});

  /// Prefilled from the sign-in form.
  final String email;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ForgotPasswordCubit>(),
      child: _ForgotPasswordView(email: email),
    );
  }
}

class _ForgotPasswordView extends StatefulWidget {
  const _ForgotPasswordView({required this.email});
  final String email;

  @override
  State<_ForgotPasswordView> createState() => _ForgotPasswordViewState();
}

class _ForgotPasswordViewState extends State<_ForgotPasswordView> {
  final _form = GlobalKey<FormState>();
  late final _email = TextEditingController(text: widget.email);

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    context.read<ForgotPasswordCubit>().submit(_email.text);
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ForgotPasswordCubit, AuthFormState>(
      listener: (context, state) {
        if (state.status != AuthFormStatus.done) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(builder: (_) => VerifyCodePage(email: normalizeEmail(_email.text), recovery: true)),
        );
      },
      builder: (context, state) => AuthScaffold(
        child: AuthCard(
          children: [
            const AuthHeading(
              title: 'Reset your password',
              subtitle: "Enter your account's email and we'll send you a code.",
            ),
            const SizedBox(height: 24),
            Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (state.error != null) ...[AuthMessage(state.error!), const SizedBox(height: 16)],
                  AuthField(
                    label: 'Email',
                    hint: 'you@business.com',
                    controller: _email,
                    icon: IconsOutline.letter,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.email],
                    onSubmitted: (_) => _submit(),
                    validator: (v) => isValidEmailShape(normalizeEmail(v)) ? null : kEmailShapeError,
                  ),
                  const SizedBox(height: 24),
                  V15Button('Send code', height: 48, expand: true, loading: state.submitting, onPressed: _submit),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
