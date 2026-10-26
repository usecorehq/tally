import 'package:equatable/equatable.dart';

/// A signed-in Qorelly user (shared auth.users id).
class MerchantUser extends Equatable {
  const MerchantUser({required this.id, required this.email});

  final String id;
  final String? email;

  @override
  List<Object?> get props => [id, email];
}
