import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/merchant_user.dart';

class MerchantUserModel extends MerchantUser {
  const MerchantUserModel({required super.id, required super.email});

  factory MerchantUserModel.fromSupabase(User user) =>
      MerchantUserModel(id: user.id, email: user.email);
}
