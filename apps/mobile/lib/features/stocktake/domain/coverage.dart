import 'package:equatable/equatable.dart';

import 'entities/shelf_scan.dart';

// Parts of the review photo where nothing was read, as apps/mp's coverage.ts.

const _side = 3;
const _cell = 1000 / _side;

/// One cell of the photo's 3 × 3 grid on the 0–1000 box scale.
class CoverageCell extends Equatable {
  const CoverageCell(this.row, this.col);
  final int row;
  final int col;

  double get x1 => col * _cell;
  double get y1 => row * _cell;
  double get x2 => (col + 1) * _cell;
  double get y2 => (row + 1) * _cell;

  @override
  List<Object?> get props => [row, col];
}

/// Only worth telling the merchant when a real share of the photo went unread.
const kMinUnreadCells = 2;

/// Grid cells no box of [rows] touches.
List<CoverageCell> unreadCells(List<ScanDetection> rows) {
  final boxes = [for (final d in rows) ...d.boxes];
  return [
    for (var row = 0; row < _side; row++)
      for (var col = 0; col < _side; col++)
        if (!boxes.any((b) => _touches(b, CoverageCell(row, col)))) CoverageCell(row, col),
  ];
}

bool _touches(ScanBox b, CoverageCell c) => b.x1 < c.x2 && b.x2 > c.x1 && b.y1 < c.y2 && b.y2 > c.y1;

const _rows = ['top', 'middle', 'bottom'];
const _cols = ['left', 'centre', 'right'];

/// "top left, bottom centre".
String describeCells(List<CoverageCell> cells) =>
    cells.map((c) => c.row == 1 && c.col == 1 ? 'centre' : '${_rows[c.row]} ${_cols[c.col]}').join(', ');

/// The review's warning, or null when coverage is fine (or there's nothing to compare).
String? coverageWarning(List<ScanDetection> rows) {
  if (rows.isEmpty) return null;
  final cells = unreadCells(rows);
  if (cells.length < kMinUnreadCells) return null;
  return 'Nothing was read in parts of this photo (shaded: ${describeCells(cells)}). '
      'If there are products there, take a closer photo of those shelves.';
}
