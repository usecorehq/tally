import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/catalogue_product.dart';
import '../../domain/usecases/catalogue_usecases.dart';

/// The product picker sheet (apps/mp's product-picker): other sizes of the current pick, a debounced
/// catalogue search where only the latest answer counts, and fetching a picked Qore ID for its name and price.
class ProductPickerCubit extends Cubit<ProductPickerState> {
  ProductPickerCubit({
    required SearchCatalogue search,
    required GetCatalogueProduct product,
    this.debounce = const Duration(milliseconds: 300),
  }) : _search = search,
       _product = product,
       super(const ProductPickerState());

  final SearchCatalogue _search;
  final GetCatalogueProduct _product;
  final Duration debounce;

  Timer? _timer;

  /// Bumped per keystroke: an answer for an older query is dropped.
  int _seq = 0;

  /// Other sizes of [currentQid], fetched when the sheet opens; none on failure.
  Future<void> loadSizes(String? currentQid) async {
    if (currentQid == null) return;
    final res = await _product(currentQid);
    if (isClosed) return;
    emit(
      state.copyWith(sizes: res.fold((_) => const [], (p) => p.variants.where((v) => v.qid != currentQid).toList())),
    );
  }

  void query(String q) {
    _timer?.cancel();
    final mine = ++_seq;
    final trimmed = q.trim();
    if (trimmed.length < kMinCatalogueQuery) {
      emit(state.copyWith(query: trimmed, searching: false, clearHits: true));
      return;
    }
    emit(state.copyWith(query: trimmed, searching: true));
    _timer = Timer(debounce, () async {
      final res = await _search(trimmed);
      if (isClosed || mine != _seq) return;
      emit(
        res.fold(
          (f) => state.copyWith(searching: false, error: f.message),
          (hits) => state.copyWith(searching: false, hits: hits, clearError: true),
        ),
      );
    });
  }

  /// A product picked by Qore ID alone (another size, a search hit): its name and price, or null on failure.
  Future<CatalogueProductDetail?> pick(String qid) async {
    emit(state.copyWith(busy: qid, clearError: true));
    final res = await _product(qid);
    if (isClosed) return res.fold((_) => null, (p) => p);
    return res.fold(
      (f) {
        emit(state.copyWith(clearBusy: true, error: f.message));
        return null;
      },
      (p) {
        emit(state.copyWith(clearBusy: true));
        return p;
      },
    );
  }

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }
}

class ProductPickerState extends Equatable {
  const ProductPickerState({this.sizes, this.query = '', this.searching = false, this.hits, this.busy, this.error});

  /// Other sizes of the current pick; null until fetched (or nothing picked).
  final List<CatalogueVariant>? sizes;
  final String query;
  final bool searching;

  /// Null below the shortest query.
  final List<CatalogueProduct>? hits;

  /// The Qore ID being fetched after a tap.
  final String? busy;
  final String? error;

  ProductPickerState copyWith({
    List<CatalogueVariant>? sizes,
    String? query,
    bool? searching,
    List<CatalogueProduct>? hits,
    bool clearHits = false,
    String? busy,
    bool clearBusy = false,
    String? error,
    bool clearError = false,
  }) => ProductPickerState(
    sizes: sizes ?? this.sizes,
    query: query ?? this.query,
    searching: searching ?? this.searching,
    hits: clearHits ? null : (hits ?? this.hits),
    busy: clearBusy ? null : (busy ?? this.busy),
    error: clearError ? null : (error ?? this.error),
  );

  @override
  List<Object?> get props => [sizes, query, searching, hits, busy, error];
}
