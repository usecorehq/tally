import 'package:flutter_test/flutter_test.dart';
import 'package:qore_tally/features/business/data/models/starter_rows_model.dart';
import 'package:qore_tally/features/business/domain/entities/starter_items.dart';

// Same API body as apps/mp's toStarterItem, row for row.

const _peak = StarterCandidate(
  qid: 'QC-7K2M-9XQ4-R',
  name: 'Peak Full Cream Milk Powder 400g',
  sizeValue: 400,
  sizeUnit: 'g',
  categoryPath: 'food/dairy/milk-powder',
  score: 0.91,
  priceMedian: 6500,
);
const _dano = StarterCandidate(
  qid: 'QC-8M3N-2PQ5-S',
  name: 'Dano Cool Cow 400g',
  categoryPath: 'food/dairy/milk-powder',
  score: 0.7,
  priceMedian: 5200,
);
const _row = StarterRow(
  key: 'essentials:dairy:0',
  groupLabel: 'Dairy',
  templateName: 'Milk powder',
  candidates: [_peak, _dano],
);
const _bare = StarterRow(key: 'essentials:dairy:1', groupLabel: 'Dairy', templateName: 'Yoghurt', candidates: []);

void main() {
  test('a suggested item starts kept at its typical price; nothing to suggest starts off', () {
    expect(StarterChoice.initial(_row), const StarterChoice(keep: true, choice: 'QC-7K2M-9XQ4-R', price: '6500'));
    expect(StarterChoice.initial(_bare), const StarterChoice(keep: false, choice: StarterChoice.own));
  });

  test('accepted: the suggestion as stocked, with its score for feedback', () {
    final c = StarterChoice.initial(_row).copyWith(opening: '6');
    expect(toStarterItem(_row, c), {
      'clientRef': 'essentials:dairy:0',
      'templateItemName': 'Milk powder',
      'outcome': 'accepted',
      'suggestedQid': 'QC-7K2M-9XQ4-R',
      'suggestedScore': 0.91,
      'name': 'Peak Full Cream Milk Powder 400g',
      'sizeValue': 400,
      'sizeUnit': 'g',
      'packQty': 1,
      'categoryPath': 'food/dairy/milk-powder',
      'price': '6500',
      'openingQuantity': 6,
    });
  });

  test('corrected: the picked product, plus what was suggested', () {
    final c = StarterChoice.initial(_row).copyWith(choice: _dano.qid, price: '5200');
    final item = toStarterItem(_row, c);
    expect(item['outcome'], 'corrected');
    expect(item['qid'], _dano.qid);
    expect(item['suggestedQid'], _peak.qid);
    expect(item.containsKey('openingQuantity'), isFalse);
  });

  test('new_item and removed', () {
    final own = StarterChoice.initial(_row).copyWith(choice: StarterChoice.own, ownName: ' Mama milk ', price: '3000');
    expect(toStarterItem(_row, own), {
      'clientRef': 'essentials:dairy:0',
      'templateItemName': 'Milk powder',
      'outcome': 'new_item',
      'suggestedQid': _peak.qid,
      'suggestedScore': 0.91,
      'name': 'Mama milk',
      'price': '3000',
    });
    expect(toStarterItem(_bare, StarterChoice.initial(_bare)), {
      'clientRef': 'essentials:dairy:1',
      'templateItemName': 'Yoghurt',
      'outcome': 'removed',
    });
  });

  test('problems: only kept rows; a price must be Naira, stock a count', () {
    expect(StarterProblems.of(StarterChoice.initial(_bare)).any, isFalse);
    final kept = StarterChoice.initial(_row);
    expect(StarterProblems.of(kept.copyWith(price: '65.505')).price, isTrue);
    expect(StarterProblems.of(kept.copyWith(opening: '1.2345')).opening, isTrue);
    expect(StarterProblems.of(kept.copyWith(choice: StarterChoice.own)).name, isTrue);
    expect(StarterProblems.of(kept).any, isFalse);
  });

  test('template rows: suggestions first, the template product deduped after them', () {
    final rows = starterRowsFromJson({
      'templates': [
        {
          'code': 'essentials',
          'groups': [
            {
              'code': 'dairy',
              'label': 'Dairy',
              'items': [
                {
                  'name': 'Milk powder',
                  'product': {'qid': _dano.qid, 'name': _dano.name, 'packQty': 1, 'category': {'path': 'food/dairy/milk-powder'}},
                  'suggestions': [
                    {
                      'qid': _peak.qid,
                      'name': _peak.name,
                      'packQty': 1,
                      'size': {'value': 400, 'unit': 'g'},
                      'category': {'path': 'food/dairy/milk-powder'},
                      'score': 0.91,
                      'price': {'median': 6500.4},
                    },
                    {'qid': _dano.qid, 'name': _dano.name, 'packQty': 1, 'category': {'path': 'food/dairy/milk-powder'}, 'score': 0.7},
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(rows.single.key, 'essentials:dairy:0');
    expect(rows.single.candidates.map((c) => c.qid), [_peak.qid, _dano.qid]);
    expect(rows.single.candidates.first.priceMedian, 6500);
  });
}
