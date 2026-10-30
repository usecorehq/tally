import 'dart:typed_data';
import 'dart:ui' as ui;

import '../../domain/photo_quality.dart';
import '../../domain/repositories/photo_tools.dart';
import '../../domain/usecases/stocktake_usecases.dart';

/// dart:ui only (no image package): it decodes at a target size, but encodes PNG, not JPEG.
class PhotoToolsImpl implements PhotoTools {
  const PhotoToolsImpl();

  @override
  Future<LocalPhotoCheck?> localCheck(Uint8List bytes) async {
    try {
      final image = await _decode(bytes, kLocalCheckEdge, upscale: true);
      try {
        final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
        if (data == null) return null;
        return localPhotoCheck(data.buffer.asUint8List(), image.width, image.height);
      } finally {
        image.dispose();
      }
    } on Exception {
      return null;
    }
  }

  @override
  Future<ShelfPhoto?> checkCopy(ShelfPhoto photo) async {
    // A 1024 px photo is usually over 1 MB as PNG; step down, then try the picked JPEG itself.
    for (final edge in const [kCheckCopyEdge, 768]) {
      final png = await _png(photo.bytes, edge);
      if (png != null && png.length <= kMaxCheckPhotoBytes) return ShelfPhoto(bytes: png, mimeType: 'image/png');
    }
    return photo.bytes.length <= kMaxCheckPhotoBytes ? photo : null;
  }

  Future<Uint8List?> _png(Uint8List bytes, int edge) async {
    try {
      final image = await _decode(bytes, edge);
      try {
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        return data?.buffer.asUint8List();
      } finally {
        image.dispose();
      }
    } on Exception {
      return null;
    }
  }

  /// Decoded with its long edge at [edge] (never enlarged unless [upscale]).
  static Future<ui.Image> _decode(Uint8List bytes, int edge, {bool upscale = false}) async {
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    final descriptor = await ui.ImageDescriptor.encoded(buffer);
    final w = descriptor.width;
    final h = descriptor.height;
    final long = w > h ? w : h;
    final scale = upscale || long > edge ? edge / long : 1.0;
    final codec = await descriptor.instantiateCodec(
      targetWidth: (w * scale).round().clamp(1, 1 << 14),
      targetHeight: (h * scale).round().clamp(1, 1 << 14),
    );
    try {
      return (await codec.getNextFrame()).image;
    } finally {
      codec.dispose();
      descriptor.dispose();
      buffer.dispose();
    }
  }
}
