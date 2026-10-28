import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../core/design/v15_widgets.dart';
import '../../domain/entities/shelf_scan.dart';

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
    if (image == null) return ColoredBox(color: V15.of(context).gray100, child: const SizedBox.expand());
    return widget.builder(context, image);
  }
}

/// The photo with every counted unit outlined (0–1000 grid). The [selected]
/// line's units are accented; tapping a unit selects its line.
class ScanPhotoView extends StatelessWidget {
  const ScanPhotoView({super.key, required this.image, this.detections = const [], this.selected, this.onSelect});
  final ui.Image image;
  final List<ScanDetection> detections;
  final String? selected;
  final ValueChanged<String?>? onSelect;

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
  });
  final ui.Image image;
  final List<ScanDetection> detections;
  final String? selected;
  final Color outline;
  final Color accent;

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
    for (final d in detections) {
      final on = d.id == selected;
      for (final b in d.boxes) {
        final r = RRect.fromRectAndRadius(toRect(b), const Radius.circular(4));
        if (on) canvas.drawRRect(r, fill);
        canvas.drawRRect(r, on ? strong : quiet);
      }
    }
  }

  @override
  bool shouldRepaint(_PhotoPainter old) =>
      old.image != image || old.detections != detections || old.selected != selected || old.accent != accent;
}

/// A square thumbnail cut from the photo around a line's largest unit (as mp's cropThumbs).
class ScanThumb extends StatelessWidget {
  const ScanThumb({super.key, required this.image, required this.box, this.size = 48});
  final ui.Image image;
  final ScanBox? box;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: size,
        height: size,
        color: c.gray100,
        child: box == null
            ? Icon(IconsOutline.box, size: 20, color: c.gray400)
            : CustomPaint(painter: _ThumbPainter(image, box!, c.surface)),
      ),
    );
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
