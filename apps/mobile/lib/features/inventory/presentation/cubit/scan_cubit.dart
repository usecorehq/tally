import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/failures.dart';
import '../../domain/barcode.dart';
import '../../domain/entities/inventory_item.dart';
import '../../domain/usecases/inventory_usecases.dart';

part 'scan_state.dart';

/// Scan-to-find for one business. The business's inventory is cached on the
/// device, so a known barcode resolves instantly and offline; only a cache miss
/// asks the API (another device may have linked it). An unknown barcode can be
/// linked to an item once, after which every scan is a cache hit.
class ScanCubit extends Cubit<ScanState> {
  ScanCubit({
    required this.businessId,
    required GetInventory getInventory,
    required FindByBarcode findByBarcode,
    required LinkBarcode linkBarcode,
  }) : _getInventory = getInventory,
       _findByBarcode = findByBarcode,
       _linkBarcode = linkBarcode,
       super(const ScanPreparing());

  final String businessId;
  final GetInventory _getInventory;
  final FindByBarcode _findByBarcode;
  final LinkBarcode _linkBarcode;

  final Map<String, InventoryItem> _byId = {};
  final Map<String, InventoryItem> _byBarcode = {};

  Future<void> prepare() async {
    emit(const ScanPreparing());
    final result = await _getInventory(businessId);
    result.fold((failure) => emit(ScanCacheError(failure.message)), (items) {
      for (final item in items) {
        _remember(item);
      }
      emit(const ScanIdle());
    });
  }

  Future<void> scanned(String raw) async {
    final barcode = normalizeBarcode(raw);
    final cached = _byBarcode[barcode];
    if (cached != null) return emit(ScanFound(cached, fromCache: true));

    emit(ScanLookingUp(barcode));
    final result = await _findByBarcode(BarcodeParams(businessId: businessId, barcode: barcode));
    result.fold(
      (failure) => emit(
        failure is NotFoundFailure
            ? ScanNotFound(barcode: barcode, linkable: _linkable())
            : ScanError(failure.message, barcode: barcode),
      ),
      (item) {
        _remember(item);
        emit(ScanFound(item, fromCache: false));
      },
    );
  }

  Future<void> link(String barcode, InventoryItem item) async {
    emit(ScanLinking(barcode));
    final result = await _linkBarcode(LinkBarcodeParams(businessId: businessId, itemId: item.id, barcode: barcode));
    result.fold((failure) => emit(ScanError(failure.message, barcode: barcode)), (linked) {
      _remember(linked);
      emit(ScanLinked(linked));
    });
  }

  /// Back to the live camera after a result.
  void resume() => emit(const ScanIdle());

  void _remember(InventoryItem item) {
    final previous = _byId[item.id];
    if (previous?.barcode != null) _byBarcode.remove(previous!.barcode);
    _byId[item.id] = item;
    if (item.barcode != null) _byBarcode[item.barcode!] = item;
  }

  List<InventoryItem> _linkable() =>
      _byId.values.where((i) => i.barcode == null).toList()..sort((a, b) => a.name.compareTo(b.name));
}
