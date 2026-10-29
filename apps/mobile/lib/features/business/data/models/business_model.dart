import '../../domain/entities/business.dart';

class BusinessModel extends Business {
  const BusinessModel({required super.id, required super.name, required super.subtypeCode, required super.role});

  factory BusinessModel.fromJson(Map<String, dynamic> json) => BusinessModel(
    id: json['id'] as String,
    name: json['name'] as String,
    subtypeCode: json['subtypeCode'] as String,
    // POST /businesses answers without a role: the creator is its owner.
    role: json['role'] as String? ?? 'owner',
  );
}
