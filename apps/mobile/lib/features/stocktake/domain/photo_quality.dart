import 'dart:typed_data';

import 'package:equatable/equatable.dart';

import 'entities/photo_check.dart';

// The photo check before a scan, as apps/mp's image.ts (localCheck) and photo-check.tsx. Advice only.

/// Below this long edge, packs on a whole shelf are too small to read reliably.
const kSmallPhotoEdge = 1500;

const kSmallPhotoWarning =
    "This photo is small, so products may be missed. Use the camera's full-size photo, or take a closer one of each shelf.";

/// The long edge of the copy the local checks read.
const kLocalCheckEdge = 320;

/// The long edge of the copy sent to the photo check (the API wants ~1024 px, ≤ 1 MB).
const kCheckCopyEdge = 1024;

const _darkMean = 60;

/// Variance of the Laplacian below this on a 320 px copy: too soft to read labels.
const _blurVariance = 40;

/// Share of near-white pixels that means reflections over the labels.
const _glareShare = 0.08;

/// The phone's own findings: no network, a few milliseconds.
class LocalPhotoCheck extends Equatable {
  const LocalPhotoCheck({this.dark = false, this.blurry = false, this.glare = false});
  final bool dark;
  final bool blurry;
  final bool glare;

  @override
  List<Object?> get props => [dark, blurry, glare];
}

/// Dark, blurry and glare checks on an RGBA copy ([width] × [height], 4 bytes a pixel).
LocalPhotoCheck localPhotoCheck(Uint8List rgba, int width, int height) {
  final n = width * height;
  if (n == 0 || rgba.length < n * 4) return const LocalPhotoCheck();
  final grey = Float64List(n);
  var sum = 0.0;
  var bright = 0;
  for (var i = 0; i < n; i++) {
    final g = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    grey[i] = g;
    sum += g;
    if (g >= 250) bright++;
  }
  var lapSum = 0.0;
  var lapSq = 0.0;
  var count = 0;
  for (var y = 1; y < height - 1; y++) {
    for (var x = 1; x < width - 1; x++) {
      final i = y * width + x;
      final lap = grey[i - width] + grey[i + width] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  final mean = count == 0 ? 0.0 : lapSum / count;
  final variance = count == 0 ? 0.0 : lapSq / count - mean * mean;
  return LocalPhotoCheck(dark: sum / n < _darkMean, blurry: variance < _blurVariance, glare: bright / n > _glareShare);
}

const kPhotoVerdictLabels = {
  PhotoVerdict.good: 'Good photo',
  PhotoVerdict.usable: 'Usable, could be better',
  PhotoVerdict.retake: 'Retake recommended',
};

const kPhotoIssueLabels = {
  PhotoIssue.notShelf: 'no stock in view',
  PhotoIssue.tooFar: 'too far',
  PhotoIssue.tooClose: 'too close',
  PhotoIssue.angled: 'at an angle',
  PhotoIssue.blurry: 'blurry',
  PhotoIssue.dark: 'too dark',
  PhotoIssue.glare: 'glare on labels',
  PhotoIssue.obstructed: 'something in the way',
  PhotoIssue.cutOff: 'shelf cut off',
};

/// The phone's own findings in plain words.
List<String> localIssues(LocalPhotoCheck? local) => [
  if (local?.dark ?? false) 'too dark',
  if (local?.blurry ?? false) 'blurry',
  if (local?.glare ?? false) 'glare on labels',
];

/// The model's issues then the phone's, each once.
List<String> photoIssues(PhotoCheck r, LocalPhotoCheck? local) =>
    {...r.issues.map((i) => kPhotoIssueLabels[i]!), ...localIssues(local)}.toList();

/// "~12 products · labels mostly readable".
String legibilityLine(PhotoCheck r) =>
    '${r.productsVisible > 0 ? '~${r.productsVisible} products · ' : ''}'
    'labels ${r.labelsLegible == LabelsLegible.most ? 'mostly' : r.labelsLegible.name} readable';

/// No verdict (busy, offline): only worth a line when the phone itself found a problem.
String? localOnlyWarning(LocalPhotoCheck? local) {
  final issues = localIssues(local);
  return issues.isEmpty ? null : 'This photo looks ${issues.join(', ')}. A clearer photo reads more products.';
}
