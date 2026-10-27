part of 'business_cubit.dart';

sealed class BusinessState extends Equatable {
  const BusinessState();

  @override
  List<Object?> get props => [];
}

class BusinessLoading extends BusinessState {
  const BusinessLoading();
}

/// The read failed — shown as an error with retry, never as "no businesses".
class BusinessLoadError extends BusinessState {
  const BusinessLoadError(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

/// The user has no business yet (onboarding happens on the web).
class BusinessNone extends BusinessState {
  const BusinessNone();
}

class BusinessReady extends BusinessState {
  const BusinessReady({required this.businesses, required this.selected});
  final List<Business> businesses;
  final Business selected;

  @override
  List<Object?> get props => [businesses, selected];
}
