import '../../domain/entities/business_vertical.dart';

class BusinessVerticalModel extends BusinessVertical {
  const BusinessVerticalModel({required super.code, required super.label, super.description, required super.subtypes});

  factory BusinessVerticalModel.fromJson(Map<String, dynamic> json) => BusinessVerticalModel(
    code: json['code'] as String,
    label: json['label'] as String,
    description: json['description'] as String?,
    subtypes: [
      for (final s in (json['subtypes'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>())
        BusinessSubtype(code: s['code'] as String, label: s['label'] as String),
    ],
  );
}
