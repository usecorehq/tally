import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../domain/auth_rules.dart';
import '../cubit/account_cubits.dart';
import 'auth_flow.dart';

/// The last reset step: the recovery code has signed the user in; set the new
/// password, then into the app.
class NewPasswordPage extends StatelessWidget {
  const NewPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(create: (_) => sl<NewPasswordCubit>(), child: const _NewPasswordView());
  }
}

class _NewPasswordView extends StatefulWidget {
  const _NewPasswordView();

  @override
  State<_NewPasswordView> createState() => _NewPasswordViewState();
}

class _NewPasswordViewState extends State<_NewPasswordView> {
  final _form = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscured = true;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    context.read<NewPasswordCubit>().submit(_password.text);
  }

  @override
  Widget build(BuildContext context) {
    final toggle = AuthPasswordToggle(obscured: _obscured, onPressed: () => setState(() => _obscured = !_obscured));
    return BlocConsumer<NewPasswordCubit, AuthFormState>(
      listener: (context, state) {
        if (state.status == AuthFormStatus.done) finishSignIn(context, state.user);
      },
      builder: (context, state) => AuthScaffold(
        child: AuthCard(
          children: [
            const AuthHeading(
              title: 'Choose a new password',
              subtitle: 'You\'ll use it to sign in to Tally and Qorelly.',
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
                      label: 'New password',
                      hint: kPasswordPlaceholder,
                      controller: _password,
                      icon: IconsOutline.lock_keyhole_minimalistic,
                      obscureText: _obscured,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.newPassword],
                      suffix: toggle,
                      validator: (v) => isPasswordLongEnough(v ?? '') ? null : kPasswordTooShortError,
                    ),
                    const SizedBox(height: 16),
                    AuthField(
                      label: 'Confirm password',
                      controller: _confirm,
                      icon: IconsOutline.lock_keyhole_minimalistic,
                      obscureText: _obscured,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _submit(),
                      validator: (v) => v == _password.text ? null : "Passwords don't match.",
                    ),
                    const SizedBox(height: 24),
                    V15Button(
                      'Save and sign in',
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
