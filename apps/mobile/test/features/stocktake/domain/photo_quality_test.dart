import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/features/stocktake/data/models/shelf_scan_model.dart';
import 'package:qore_tally/features/stocktake/domain/entities/photo_check.dart';
import 'package:qore_tally/features/stocktake/domain/photo_quality.dart';

// The local photo checks on synthetic images, and the photo check's copy (apps/mp's image.ts, photo-check.tsx).

const _w = 64;
const _h = 48;

/// An RGBA image whose grey level at (x, y) is [level].
Uint8List _image(int Function(int x, int y) level) {
  final out = Uint8List(_w * _h * 4);
  for (var y = 0; y < _h; y++) {
    for (var x = 0; x < _w; x++) {
      final i = (y * _w + x) * 4;
      final v = level(x, y);
      out
        ..[i] = v
        ..[i + 1] = v
        ..[i + 2] = v
        ..[i + 3] = 255;
    }
  }
  return out;
}

void main() {
  group('localPhotoCheck', () {
    test('a dark photo is dark (and, being flat, blurry)', () {
      final r = localPhotoCheck(_image((_, _) => 20), _w, _h);
      expect(r, const LocalPhotoCheck(dark: true, blurry: true));
    });

    test('a blown-out photo has glare', () {
      final r = localPhotoCheck(_image((x, _) => x < _w / 4 ? 255 : 140), _w, _h);
      expect(r.glare, isTrue);
      expect(r.dark, isFalse);
    });

    test('a flat mid-grey photo is blurry, not dark or glared', () {
      expect(localPhotoCheck(_image((_, _) => 128), _w, _h), const LocalPhotoCheck(blurry: true));
    });

    test('a textured photo is sharp and clean', () {
      final r = localPhotoCheck(_image((x, y) => (x + y).isEven ? 70 : 190), _w, _h);
      expect(r, const LocalPhotoCheck());
    });

    test('a few highlights are not glare', () {
      final r = localPhotoCheck(_image((x, y) => x == 0 ? 255 : ((x + y).isEven ? 70 : 190)), _w, _h);
      expect(r.glare, isFalse, reason: '1 column in 64 is under 8%');
    });

    test('an empty or short buffer finds nothing', () {
      expect(localPhotoCheck(Uint8List(0), 0, 0), const LocalPhotoCheck());
      expect(localPhotoCheck(Uint8List(8), _w, _h), const LocalPhotoCheck());
    });
  });

  group('photo check copy', () {
    final check = photoCheckFromJson({
      'verdict': 'retake',
      'issues': ['too_far', 'blurry', 'something_new'],
      'instruction': 'Step closer so one or two shelves fill the photo.',
      'productsVisible': 30,
      'labelsLegible': 'most',
      'region': {'x1': 420, 'y1': 120, 'x2': 980, 'y2': 560},
      'model': 'muse-spark-1.3',
      'ms': 2400,
    });

    test('parses the verdict, skipping unknown issues', () {
      expect(check.verdict, PhotoVerdict.retake);
      expect(check.issues, [PhotoIssue.tooFar, PhotoIssue.blurry]);
      expect(check.labelsLegible, LabelsLegible.most);
    });

    test('verdict labels match the web', () {
      expect(kPhotoVerdictLabels, {
        PhotoVerdict.good: 'Good photo',
        PhotoVerdict.usable: 'Usable, could be better',
        PhotoVerdict.retake: 'Retake recommended',
      });
    });

    test('issues are the model\'s then the phone\'s, each once', () {
      expect(photoIssues(check, const LocalPhotoCheck(blurry: true, dark: true)), ['too far', 'blurry', 'too dark']);
    });

    test('legibility line', () {
      expect(legibilityLine(check), '~30 products · labels mostly readable');
      expect(
        legibilityLine(const PhotoCheck(verdict: PhotoVerdict.usable, labelsLegible: LabelsLegible.few)),
        'labels few readable',
      );
    });

    test('no verdict: a line only when the phone found something', () {
      expect(localOnlyWarning(null), isNull);
      expect(localOnlyWarning(const LocalPhotoCheck()), isNull);
      expect(
        localOnlyWarning(const LocalPhotoCheck(dark: true, glare: true)),
        'This photo looks too dark, glare on labels. A clearer photo reads more products.',
      );
    });
  });
}
