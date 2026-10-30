import '../../domain/entities/catalogue_product.dart';
import '../../domain/entities/shelf_scan.dart';

// Qore Catalog v1 shapes as apps/api passes them through (@tally/catalog-client types). Missing fields fall back.

List<CatalogueProduct> catalogueSearchFromJson(Map<String, dynamic> j) => [
  for (final p in j['items'] is List<dynamic> ? j['items'] as List<dynamic> : const [])
    if (p is Map<String, dynamic>) _product(p),
];

/// The id a merged product now lives at, else null.
String? mergedInto(Map<String, dynamic> j) => j['mergedInto'] is String ? j['mergedInto'] as String : null;

CatalogueProductDetail catalogueProductFromJson(Map<String, dynamic> j) {
  final p = _product(j);
  final price = j['price'] is Map<String, dynamic> ? j['price'] as Map<String, dynamic> : null;
  return CatalogueProductDetail(
    qid: p.qid,
    name: p.name,
    variantLabel: p.variantLabel,
    size: p.size,
    packQty: p.packQty,
    brand: p.brand,
    image: p.image,
    priceMedian: (price?['median'] as num?)?.round(),
    priceMin: (price?['min'] as num?)?.round(),
    priceMax: (price?['max'] as num?)?.round(),
    variants: [
      for (final v in j['variants'] is List<dynamic> ? j['variants'] as List<dynamic> : const [])
        if (v is Map<String, dynamic> && v['qid'] is String)
          CatalogueVariant(
            qid: v['qid'] as String,
            variantLabel: v['variantLabel'] as String?,
            packQty: (v['packQty'] as num?)?.toInt() ?? 1,
          ),
    ],
  );
}

CatalogueProduct _product(Map<String, dynamic> j) {
  final size = j['size'] is Map<String, dynamic> ? j['size'] as Map<String, dynamic> : null;
  final brand = j['brand'] is Map<String, dynamic> ? j['brand'] as Map<String, dynamic> : null;
  final image = j['image'] is Map<String, dynamic> ? j['image'] as Map<String, dynamic> : null;
  final qid = j['qid'] as String? ?? '';
  return CatalogueProduct(
    qid: qid,
    name: j['name'] as String? ?? qid,
    variantLabel: j['variantLabel'] as String?,
    size: size?['value'] is num ? ScanSize(size!['value'] as num, size['unit'] as String? ?? '') : null,
    packQty: (j['packQty'] as num?)?.toInt() ?? 1,
    brand: brand?['name'] as String?,
    image: image?['url'] is String
        ? CatalogImage(
            url: image!['url'] as String,
            width: (image['width'] as num?)?.toInt(),
            height: (image['height'] as num?)?.toInt(),
          )
        : null,
  );
}
