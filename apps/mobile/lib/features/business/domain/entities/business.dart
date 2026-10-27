import 'package:equatable/equatable.dart';

class Business extends Equatable {
  const Business({required this.id, required this.name, required this.subtypeCode, required this.role});

  final String id;
  final String name;

  /// Qore Catalog sub-type, e.g. `supermarket`.
  final String subtypeCode;

  /// `owner` or `staff`.
  final String role;

  @override
  List<Object?> get props => [id, name, subtypeCode, role];
}
