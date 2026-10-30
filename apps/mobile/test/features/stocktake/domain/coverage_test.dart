import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/features/stocktake/domain/coverage.dart';
import 'package:qore_tally/features/stocktake/domain/entities/shelf_scan.dart';

ScanDetection _line(String id, List<ScanBox> boxes) =>
    ScanDetection(id: id, brand: '', name: 'Item', pack: '', count: 1, boxes: boxes);

void main() {
  test('a box touching every cell leaves nothing unread', () {
    expect(
      unreadCells([
        _line('a', const [ScanBox(0, 0, 1000, 1000)]),
      ]),
      isEmpty,
    );
  });

  test('a box in the top-left cell leaves the other eight', () {
    final cells = unreadCells([
      _line('a', const [ScanBox(10, 10, 300, 300)]),
    ]);
    expect(cells, hasLength(8));
    expect(cells.first, const CoverageCell(0, 1));
  });

  test('a box only on a cell edge does not touch the next cell', () {
    // 333.33… is the edge: a box ending at 333 stays in the first column.
    final cells = unreadCells([
      _line('a', const [ScanBox(0, 0, 333, 1000)]),
    ]);
    expect(cells.map((c) => c.col).toSet(), {1, 2});
  });

  test('boxes of every row count', () {
    final cells = unreadCells([
      _line('a', const [ScanBox(0, 0, 1000, 330)]),
      _line('b', const [ScanBox(0, 340, 1000, 660)]),
    ]);
    expect(cells, const [CoverageCell(2, 0), CoverageCell(2, 1), CoverageCell(2, 2)]);
  });

  test('cells on the 0–1000 scale', () {
    const c = CoverageCell(1, 2);
    expect(c.x1, closeTo(666.67, 0.01));
    expect(c.y1, closeTo(333.33, 0.01));
    expect(c.x2, 1000);
    expect(c.y2, closeTo(666.67, 0.01));
  });

  test('descriptions, centre on its own', () {
    expect(
      describeCells(const [CoverageCell(0, 0), CoverageCell(1, 1), CoverageCell(2, 1), CoverageCell(1, 2)]),
      'top left, centre, bottom centre, middle right',
    );
  });

  test('the warning needs two unread cells and some lines', () {
    expect(coverageWarning(const []), isNull);
    // Eight cells covered, one unread: not worth a warning.
    expect(
      coverageWarning([
        _line('a', const [ScanBox(0, 0, 1000, 660)]),
        _line('b', const [ScanBox(0, 0, 660, 1000)]),
      ]),
      isNull,
    );
    expect(
      coverageWarning([
        _line('a', const [ScanBox(0, 0, 1000, 660)]),
      ]),
      'Nothing was read in parts of this photo (shaded: bottom left, bottom centre, bottom right). '
      'If there are products there, take a closer photo of those shelves.',
    );
  });
}
