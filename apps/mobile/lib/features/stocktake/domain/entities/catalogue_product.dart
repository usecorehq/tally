import 'package:equatable/equatable.dart';

import 'shelf_scan.dart';

// GET /api/catalog/products (search) and /api/catalog/products/:qid (detail), for the product picker.

/// A catalogue search hit: no price; fetch the product for it.
class CatalogueProduct extends Equatable {
  const CatalogueProduct({
    required this.qid,
    required this.name,
    this.variantLabel,
    this.size,
    this.packQty = 1,
    this.brand,
    this.image,
  });
  final String qid;
  final String name;
  final String? variantLabel;
  final ScanSize? size;
  final int packQty;
  final String? brand;
  final CatalogImage? image;

  @override
  List<Object?> get props => [qid, name, variantLabel, size, packQty, brand, image];
}

/// Another size of a product.
class CatalogueVariant extends Equatable {
  const CatalogueVariant({required this.qid, this.variantLabel, this.packQty = 1});
  final String qid;
  final String? variantLabel;
  final int packQty;

  @override
  List<Object?> get props => [qid, variantLabel, packQty];
}

/// One product with its indicative price (whole Naira) and its other sizes.
class CatalogueProductDetail extends CatalogueProduct {
  const CatalogueProductDetail({
    required super.qid,
    required super.name,
    super.variantLabel,
    super.size,
    super.packQty,
    super.brand,
    super.image,
    this.priceMedian,
    this.priceMin,
    this.priceMax,
    this.variants = const [],
  });
  final int? priceMedian;
  final int? priceMin;
  final int? priceMax;
  final List<CatalogueVariant> variants;

  /// As a line's pick, so the review shows it like a suggestion (no match strength).
  ScanCandidate toCandidate() => ScanCandidate(
    qid: qid,
    name: name,
    score: 0,
    priceMedian: priceMedian,
    priceMin: priceMin,
    priceMax: priceMax,
    brand: brand,
    variantLabel: variantLabel,
    size: size,
    packQty: packQty,
    image: image,
  );

  @override
  List<Object?> get props => [...super.props, priceMedian, priceMin, priceMax, variants];
}

/// "400g × 6", the variant label first; null when there's nothing to say.
String? sizeLabel({String? variantLabel, ScanSize? size, int packQty = 1}) {
  if (variantLabel != null) return variantLabel;
  final parts = [if (size != null) '${size.value}${size.unit}', if (packQty > 1) '× $packQty'];
  return parts.isEmpty ? null : parts.join(' ');
}
