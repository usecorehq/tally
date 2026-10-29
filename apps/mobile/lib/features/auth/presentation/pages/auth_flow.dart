import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/merchant_user.dart';
import '../bloc/auth_bloc.dart';

/// Signed in from any step of the way in: drop the pushed auth screens, then
/// let [AuthBloc] swap the root to the app.
void finishSignIn(BuildContext context, MerchantUser? user) {
  final bloc = context.read<AuthBloc>();
  Navigator.of(context).popUntil((route) => route.isFirst);
  bloc.add(AuthUserChanged(user));
}
