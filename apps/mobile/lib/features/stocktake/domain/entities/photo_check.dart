import 'package:equatable/equatable.dart';

import 'shelf_scan.dart';

// POST …/vision/photo-check: Muse Spark's verdict on a photo before a scan. Advice only.

enum PhotoVerdict { good, usable, retake }

/// Worst first in [PhotoCheck.issues]; [wire] is the API's spelling.
enum PhotoIssue {
  notShelf('not_shelf'),
  tooFar('too_far'),
  tooClose('too_close'),
  angled('angled'),
  blurry('blurry'),
  dark('dark'),
  glare('glare'),
  obstructed('obstructed'),
  cutOff('cut_off');

  const PhotoIssue(this.wire);
  final String wire;
}

enum LabelsLegible { most, some, few, none }

class PhotoCheck extends Equatable {
  const PhotoCheck({
    required this.verdict,
    this.issues = const [],
    this.instruction = '',
    this.productsVisible = 0,
    this.labelsLegible = LabelsLegible.some,
    this.region,
    this.model = '',
    this.ms = 0,
  });

  final PhotoVerdict verdict;
  final List<PhotoIssue> issues;

  /// One short thing to do; empty when the photo is good.
  final String instruction;
  final int productsVisible;
  final LabelsLegible labelsLegible;

  /// The area with the most readable products (0–1000 grid), or null.
  final ScanBox? region;
  final String model;
  final int ms;

  @override
  List<Object?> get props => [verdict, issues, instruction, productsVisible, labelsLegible, region, model, ms];
}
