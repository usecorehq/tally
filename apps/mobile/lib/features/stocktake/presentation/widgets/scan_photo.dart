import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dartz/dartz.dart' show Either;
import 'package:flutter/material.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../../../core/error/failures.dart';
import '../../domain/coverage.dart';
import '../../domain/entities/shelf_scan.dart';

/// Fetches a presigned photo or crop link (the DownloadPhoto use case).
typedef PhotoBytesLoader = Future<Either<Failure, Uint8List>> Function(String url);

/// The review's shelf photo: decoded, still [loading], or unavailable (both null and false).
class ReviewImage {
  const ReviewImage(this.image, {this.loading = false});
  const ReviewImage.loading() : image = null, loading = true;
  const ReviewImage.none() : image = null, loading = false;
  final ui.Image? image;
  final bool loading;
}

/// Hands the stored-photo loader down to crop thumbnails; without one they show the box icon.
class PhotoDownloads extends InheritedWidget {
  const PhotoDownloads({super.key, required this.load, required super.child});
  final PhotoBytesLoader load;

  static PhotoBytesLoader? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PhotoDownloads>()?.load;

  @override
  bool updateShouldNotify(PhotoDownloads old) => old.load != load;
}

/// Downloads and decodes a stored photo ([url]); [builder] gets loading first, then the image or none.
class RemotePhoto extends StatefulWidget {
  const RemotePhoto({super.key, required this.url, required this.load, required this.builder});
  final String? url;
  final PhotoBytesLoader load;
  final Widget Function(BuildContext context, ReviewImage photo) builder;

  @override
  State<RemotePhoto> createState() => _RemotePhotoState();
}

class _RemotePhotoState extends State<RemotePhoto> {
  ReviewImage _photo = const ReviewImage.loading();

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    final url = widget.url;
    if (url == null) return setState(() => _photo = const ReviewImage.none());
    final bytes = await widget.load(url);
    ui.Image? image;
    try {
      image = await bytes.fold((_) async => null, (b) => decodeImageFromList(b));
    } on Exception {
      image = null;
    }
    if (!mounted) return image?.dispose();
    setState(() => _photo = image == null ? const ReviewImage.none() : ReviewImage(image));
  }

  @override
  void dispose() {
    _photo.image?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _photo);
}

/// The photo's place while it downloads.
class PhotoSkeleton extends StatelessWidget {
  const PhotoSkeleton({super.key, this.height = 240});
  final double height;

  @override
  Widget build(BuildContext context) => V15PulseSkeleton(height: height, radius: V15.sheetRadius);
}

/// Decodes the shelf photo once and hands it to [builder]; a gray block until then.
class DecodedPhoto extends StatefulWidget {
  const DecodedPhoto({super.key, required this.bytes, required this.builder});
  final Uint8List bytes;
  final Widget Function(BuildContext context, ui.Image image) builder;

  @override
  State<DecodedPhoto> createState() => _DecodedPhotoState();
}

class _DecodedPhotoState extends State<DecodedPhoto> {
  ui.Image? _image;

  @override
  void initState() {
    super.initState();
    _decode();
  }

  @override
  void didUpdateWidget(DecodedPhoto old) {
    super.didUpdateWidget(old);
    if (!identical(old.bytes, widget.bytes)) _decode();
  }

  Future<void> _decode() async {
    final image = await decodeImageFromList(widget.bytes);
    if (!mounted) return image.dispose();
    setState(() {
      _image?.dispose();
      _image = image;
    });
  }

  @override
  void dispose() {
    _image?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final image = _image;
    if (image == null) {
      // In a scroll view there's no height to fill: hold a photo-sized block instead.
      return LayoutBuilder(
        builder: (context, box) => ColoredBox(
          color: V15.of(context).gray100,
          child: SizedBox(width: double.infinity, height: box.hasBoundedHeight ? double.infinity : 240),
        ),
      );
    }
    return widget.builder(context, image);
  }
}

/// The photo with every counted unit outlined (0–1000 grid). The [selected]
/// line's units are accented; tapping a unit selects its line.
class ScanPhotoView extends StatelessWidget {
  const ScanPhotoView({
    super.key,
    required this.image,
    this.detections = const [],
    this.selected,
    this.onSelect,
    this.unread = const [],
  });
  final ui.Image image;
  final List<ScanDetection> detections;
  final String? selected;
  final ValueChanged<String?>? onSelect;

  /// Parts where nothing was read, shaded so the merchant can check them (see coverage.dart).
  final List<CoverageCell> unread;

  /// The smallest box under the tap, so a unit inside a bigger one still wins.
  String? _hit(Offset p, Size size) {
    final x = p.dx / size.width * 1000;
    final y = p.dy / size.height * 1000;
    String? id;
    double? best;
    for (final d in detections) {
      for (final b in d.boxes) {
        if (x < b.x1 || x > b.x2 || y < b.y1 || y > b.y2) continue;
        if (best == null || b.area < best) (id, best) = (d.id, b.area);
      }
    }
    return id;
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return AspectRatio(
      aspectRatio: image.width / image.height,
      child: LayoutBuilder(
        builder: (context, box) => GestureDetector(
          onTapUp: onSelect == null ? null : (t) => onSelect!(_hit(t.localPosition, box.biggest)),
          child: CustomPaint(
            size: box.biggest,
            painter: _PhotoPainter(
              image: image,
              detections: detections,
              selected: selected,
              outline: c.surface,
              accent: c.primary,
              unread: unread,
            ),
          ),
        ),
      ),
    );
  }
}

class _PhotoPainter extends CustomPainter {
  _PhotoPainter({
    required this.image,
    required this.detections,
    required this.selected,
    required this.outline,
    required this.accent,
    this.unread = const [],
  });
  final ui.Image image;
  final List<ScanDetection> detections;
  final String? selected;
  final Color outline;
  final Color accent;
  final List<CoverageCell> unread;

  /// mp's amber-300 at 70%.
  static const _unreadBorder = Color(0xB3FCD34D);

  @override
  void paint(Canvas canvas, Size size) {
    final src = Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble());
    canvas.drawImageRect(image, src, Offset.zero & size, Paint()..filterQuality = FilterQuality.medium);
    Rect toRect(ScanBox b) => Rect.fromLTRB(
      b.x1 / 1000 * size.width,
      b.y1 / 1000 * size.height,
      b.x2 / 1000 * size.width,
      b.y2 / 1000 * size.height,
    );
    final quiet = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = outline.withValues(alpha: selected == null ? 0.9 : 0.45);
    final strong = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = accent;
    final fill = Paint()..color = accent.withValues(alpha: 0.18);
    final shade = Paint()..color = Colors.black.withValues(alpha: 0.35);
    final dash = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = _unreadBorder;
    for (final cell in unread) {
      final r = Rect.fromLTRB(
        cell.x1 / 1000 * size.width,
        cell.y1 / 1000 * size.height,
        cell.x2 / 1000 * size.width,
        cell.y2 / 1000 * size.height,
      );
      canvas.drawRect(r, shade);
      _dashed(canvas, r.deflate(0.5), dash);
    }
    for (final d in detections) {
      final on = d.id == selected;
      for (final b in d.boxes) {
        final r = RRect.fromRectAndRadius(toRect(b), const Radius.circular(4));
        if (on) canvas.drawRRect(r, fill);
        canvas.drawRRect(r, on ? strong : quiet);
      }
    }
  }

  static void _dashed(Canvas canvas, Rect r, Paint paint) {
    for (final metric in (Path()..addRect(r)).computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 7) {
        canvas.drawPath(metric.extractPath(d, d + 4), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_PhotoPainter old) =>
      old.image != image ||
      old.detections != detections ||
      old.selected != selected ||
      old.accent != accent ||
      old.unread != unread;
}

/// A square thumbnail cut from the photo around a line's largest unit (as mp's cropThumbs); without the photo,
/// the stored crop ([cropUrl]), else the box icon. Gray while the photo loads.
class ScanThumb extends StatelessWidget {
  const ScanThumb({
    super.key,
    required this.image,
    required this.box,
    this.cropUrl,
    this.loading = false,
    this.size = 48,
  });
  final ui.Image? image;
  final ScanBox? box;
  final String? cropUrl;
  final bool loading;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final image = this.image;
    final load = PhotoDownloads.of(context);
    final icon = Icon(IconsOutline.box, size: size < 64 ? 20 : 32, color: c.gray400);
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: size,
        height: size,
        color: c.gray100,
        child: image != null && box != null
            ? CustomPaint(painter: _ThumbPainter(image, box!, c.surface))
            : loading
            ? null
            : cropUrl != null && load != null
            ? _Crop(url: cropUrl!, load: load, fallback: icon)
            : icon,
      ),
    );
  }
}

class _Crop extends StatefulWidget {
  const _Crop({required this.url, required this.load, required this.fallback});
  final String url;
  final PhotoBytesLoader load;
  final Widget fallback;

  @override
  State<_Crop> createState() => _CropState();
}

class _CropState extends State<_Crop> {
  Uint8List? _bytes;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    widget.load(widget.url).then((r) {
      if (!mounted) return;
      setState(() {
        _bytes = r.fold((_) => null, (b) => b);
        _done = true;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _bytes;
    if (!_done) return const SizedBox.shrink();
    if (bytes == null) return widget.fallback;
    return Image.memory(bytes, fit: BoxFit.cover, errorBuilder: (_, _, _) => widget.fallback);
  }
}

class _ThumbPainter extends CustomPainter {
  _ThumbPainter(this.image, this.box, this.background);
  final ui.Image image;
  final ScanBox box;
  final Color background;

  @override
  void paint(Canvas canvas, Size size) {
    final w = (box.x2 - box.x1) / 1000 * image.width;
    final h = (box.y2 - box.y1) / 1000 * image.height;
    final side = (w > h ? w : h) * 1.1;
    final cx = (box.x1 + box.x2) / 2000 * image.width;
    final cy = (box.y1 + box.y2) / 2000 * image.height;
    canvas.drawRect(Offset.zero & size, Paint()..color = background);
    canvas.drawImageRect(
      image,
      Rect.fromCenter(center: Offset(cx, cy), width: side, height: side),
      Offset.zero & size,
      Paint()..filterQuality = FilterQuality.medium,
    );
  }

  @override
  bool shouldRepaint(_ThumbPainter old) => old.image != image || old.box != box;
}
