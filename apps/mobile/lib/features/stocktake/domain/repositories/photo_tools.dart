import 'dart:typed_data';

import '../photo_quality.dart';
import '../usecases/stocktake_usecases.dart';

/// On-device work on a picked photo before the scan: the local checks and the photo-check copy.
abstract class PhotoTools {
  /// Dark, blurry and glare on a [kLocalCheckEdge] px copy; null when the photo can't be decoded.
  Future<LocalPhotoCheck?> localCheck(Uint8List bytes);

  /// A ~[kCheckCopyEdge] px copy under [kMaxCheckPhotoBytes]; null when none fits.
  Future<ShelfPhoto?> checkCopy(ShelfPhoto photo);
}
