import 'package:equatable/equatable.dart';

/// A Qore Catalog business type (`GET /api/catalog/verticals`), e.g. Retail,
/// with the sub-types a business is created under, e.g. Supermarket.
class BusinessVertical extends Equatable {
  const BusinessVertical({required this.code, required this.label, this.description, required this.subtypes});

  final String code;
  final String label;
  final String? description;
  final List<BusinessSubtype> subtypes;

  @override
  List<Object?> get props => [code, label, description, subtypes];
}

class BusinessSubtype extends Equatable {
  const BusinessSubtype({required this.code, required this.label});

  final String code;
  final String label;

  @override
  List<Object?> get props => [code, label];
}
