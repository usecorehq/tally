part of 'scan_cubit.dart';

sealed class ScanState extends Equatable {
  const ScanState();

  @override
  List<Object?> get props => [];
}

/// Loading the business's inventory into the on-device cache.
class ScanPreparing extends ScanState {
  const ScanPreparing();
}

/// The inventory couldn't be loaded; scanning still works through the API.
class ScanCacheError extends ScanState {
  const ScanCacheError(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

/// Camera live, waiting for a barcode.
class ScanIdle extends ScanState {
  const ScanIdle();
}

class ScanLookingUp extends ScanState {
  const ScanLookingUp(this.barcode);
  final String barcode;

  @override
  List<Object?> get props => [barcode];
}

class ScanFound extends ScanState {
  const ScanFound(this.item, {required this.fromCache});
  final InventoryItem item;

  /// Resolved on the device without a network call.
  final bool fromCache;

  @override
  List<Object?> get props => [item, fromCache];
}

/// No item has this barcode yet: offer to link it to one.
class ScanNotFound extends ScanState {
  const ScanNotFound({required this.barcode, required this.linkable});
  final String barcode;

  /// Items without a barcode, to link this one to.
  final List<InventoryItem> linkable;

  @override
  List<Object?> get props => [barcode, linkable];
}

class ScanLinking extends ScanState {
  const ScanLinking(this.barcode);
  final String barcode;

  @override
  List<Object?> get props => [barcode];
}

class ScanLinked extends ScanState {
  const ScanLinked(this.item);
  final InventoryItem item;

  @override
  List<Object?> get props => [item];
}

class ScanError extends ScanState {
  const ScanError(this.message, {this.barcode});
  final String message;
  final String? barcode;

  @override
  List<Object?> get props => [message, barcode];
}
