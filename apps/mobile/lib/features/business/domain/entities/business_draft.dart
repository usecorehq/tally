import 'package:equatable/equatable.dart';

/// Onboarding step 1's answers. Nothing is created until step 2 finishes or
/// is skipped, so the merchant can go back and change them.
class BusinessDraft extends Equatable {
  const BusinessDraft({required this.name, required this.subtypeCode});

  final String name;

  /// Qore Catalog sub-type, e.g. `supermarket`.
  final String subtypeCode;

  @override
  List<Object?> get props => [name, subtypeCode];
}
