var test = require('node:test');
var assert = require('node:assert');
var QL = require('../quote-logic.js');

var QUOTES = [
  { id: 1, text: 'A', author: 'X', category: 'motivation' },
  { id: 2, text: 'B', author: 'Y', category: 'wisdom' },
  { id: 3, text: 'C', author: 'Z', category: 'life' }
];

test.describe('selectWeightedQuote', function() {
  test.it('returns null for an empty list', function() {
    assert.strictEqual(QL.selectWeightedQuote([], {}), null);
    assert.strictEqual(QL.selectWeightedQuote(null, {}), null);
  });

  test.it('picks the first quote when the random draw is at the low end', function() {
    var picked = QL.selectWeightedQuote(QUOTES, {}, function() { return 0; });
    assert.strictEqual(picked.id, 1);
  });

  test.it('picks the last quote when the random draw is at the high end', function() {
    var picked = QL.selectWeightedQuote(QUOTES, {}, function() { return 0.999999; });
    assert.strictEqual(picked.id, 3);
  });

  test.it('walks the cumulative weights with uniform weights', function() {
    // Three quotes, weight 1 each -> total 3. rand = 0.5*3 = 1.5 -> second quote.
    var picked = QL.selectWeightedQuote(QUOTES, {}, function() { return 0.5; });
    assert.strictEqual(picked.id, 2);
  });

  test.it('gives a higher-scored category a larger share of the range', function() {
    // wisdom score 10 -> weight 4; others 1. Total 6.
    // rand = 0.25*6 = 1.5 lands inside quote 2's [1, 5] band.
    var scores = { wisdom: 10 };
    assert.strictEqual(QL.selectWeightedQuote(QUOTES, scores, function() { return 0.25; }).id, 2);
    assert.strictEqual(QL.selectWeightedQuote(QUOTES, scores, function() { return 0.9; }).id, 3);
  });

  test.it('clamps negative weights instead of shrinking the total', function() {
    // motivation score -100 would give weight -29; it is clamped to 0 so quote 1
    // can never be picked, and the remaining total stays positive.
    var picked = QL.selectWeightedQuote(QUOTES, { motivation: -100 }, function() { return 0; });
    assert.strictEqual(picked.id, 2);
  });

  test.it('falls back to the first quote when every weight is zero', function() {
    var single = [{ id: 9, text: 'Q', author: 'A', category: 'life' }];
    var picked = QL.selectWeightedQuote(single, { life: -1000 }, function() { return 0.5; });
    assert.strictEqual(picked.id, 9);
  });

  test.it('treats a missing score map as neutral', function() {
    var picked = QL.selectWeightedQuote(QUOTES, undefined, function() { return 0.5; });
    assert.strictEqual(picked.id, 2);
  });
});

test.describe('history recording', function() {
  var quote = { id: 1, text: 'A', author: 'X', category: 'motivation' };
  var other = { id: 2, text: 'B', author: 'Y', category: 'wisdom' };

  test.it('records a quote with its day key', function() {
    var history = QL.addHistoryEntry([], quote, new Date(2026, 0, 15, 9, 30));
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].date, '2026-01-15');
    assert.strictEqual(history[0].id, 1);
    assert.strictEqual(history[0].text, 'A');
    assert.strictEqual(history[0].author, 'X');
    assert.strictEqual(history[0].category, 'motivation');
  });

  test.it('does not record the same quote twice on the same day', function() {
    var first = QL.addHistoryEntry([], quote, new Date(2026, 0, 15, 9, 0));
    var second = QL.addHistoryEntry(first, quote, new Date(2026, 0, 15, 22, 0));
    assert.strictEqual(second.length, 1);
  });

  test.it('records a different quote on the same day', function() {
    var first = QL.addHistoryEntry([], quote, new Date(2026, 0, 15));
    var second = QL.addHistoryEntry(first, other, new Date(2026, 0, 15));
    assert.strictEqual(second.length, 2);
  });

  test.it('records the same quote again on a later day', function() {
    var first = QL.addHistoryEntry([], quote, new Date(2026, 0, 15));
    var second = QL.addHistoryEntry(first, quote, new Date(2026, 0, 16));
    assert.strictEqual(second.length, 2);
    assert.deepStrictEqual(second.map(function(e) { return e.date; }), ['2026-01-15', '2026-01-16']);
  });

  test.it('does not mutate the input array', function() {
    var original = [];
    QL.addHistoryEntry(original, quote, new Date(2026, 0, 15));
    assert.strictEqual(original.length, 0);
  });

  test.it('keeps entries inside the 30 day window and drops older ones', function() {
    var history = [
      { id: 1, text: 'A', author: 'X', date: '2026-01-15' }, // today
      { id: 2, text: 'B', author: 'Y', date: '2025-12-18' }, // 28 days old, kept
      { id: 3, text: 'C', author: 'Z', date: '2025-12-17' }, // 29 days old, kept
      { id: 4, text: 'D', author: 'W', date: '2025-12-16' }, // 30 days old, dropped
      { id: 5, text: 'E', author: 'V', date: '2025-11-01' }  // way older, dropped
    ];
    var pruned = QL.addHistoryEntry(history, { id: 1, text: 'A', author: 'X' }, new Date(2026, 0, 15));
    assert.deepStrictEqual(pruned.map(function(e) { return e.id; }), [1, 2, 3]);
  });

  test.it('drops entries dated in the future and malformed entries', function() {
    var history = [
      { id: 1, text: 'A', author: 'X', date: '2026-02-01' },
      { id: 2, text: 'B', author: 'Y' },
      null
    ];
    assert.deepStrictEqual(QL.pruneHistory(history, '2026-01-15'), []);
  });

  test.it('honours a custom retention window', function() {
    var history = [{ id: 1, text: 'A', author: 'X', date: '2026-01-10' }];
    assert.strictEqual(QL.pruneHistory(history, '2026-01-15', 3).length, 0);
    assert.strictEqual(QL.pruneHistory(history, '2026-01-15', 7).length, 1);
    assert.strictEqual(QL.pruneHistory(history, '2026-01-15', 30).length, 1);
  });

  test.it('prunes but records nothing when the quote is missing an id', function() {
    var history = [{ id: 1, text: 'A', author: 'X', date: '2025-01-01' }];
    assert.deepStrictEqual(QL.addHistoryEntry(history, null, new Date(2026, 0, 15)), []);
  });

  test.it('groups entries by day, newest day first', function() {
    var history = [
      { id: 1, text: 'A', author: 'X', date: '2026-01-14' },
      { id: 2, text: 'B', author: 'Y', date: '2026-01-15' },
      { id: 3, text: 'C', author: 'Z', date: '2026-01-14' }
    ];
    var groups = QL.groupHistoryByDate(history);
    assert.deepStrictEqual(groups.map(function(g) { return g.date; }), ['2026-01-15', '2026-01-14']);
    assert.strictEqual(groups[0].entries.length, 1);
    assert.deepStrictEqual(groups[1].entries.map(function(e) { return e.id; }), [1, 3]);
  });

  test.it('pads month and day in the date key', function() {
    assert.strictEqual(QL.toDateKey(new Date(2026, 8, 5)), '2026-09-05');
  });
});

test.describe('validateFavoritesImport', function() {
  test.it('accepts a plain array of quotes', function() {
    var raw = JSON.stringify([{ id: 1, text: 'A', author: 'X', category: 'life' }]);
    var result = QL.validateFavoritesImport(raw);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.favorites, [{ id: 1, text: 'A', author: 'X', category: 'life' }]);
  });

  test.it('accepts a wrapper object with a favorites array', function() {
    var raw = JSON.stringify({ favorites: [{ id: 2, text: 'B', author: 'Y' }] });
    var result = QL.validateFavoritesImport(raw);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.favorites.length, 1);
  });

  test.it('strips unknown fields', function() {
    var raw = JSON.stringify([{ id: 1, text: 'A', author: 'X', evil: '<script>' }]);
    var result = QL.validateFavoritesImport(raw);
    assert.deepStrictEqual(Object.keys(result.favorites[0]), ['id', 'text', 'author']);
  });

  test.it('rejects malformed JSON with a readable message', function() {
    var result = QL.validateFavoritesImport('{not json');
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /not valid JSON/);
  });

  test.it('rejects a non-list payload', function() {
    var result = QL.validateFavoritesImport('{"foo":1}');
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /Expected a list of favorites/);
  });

  test.it('rejects an empty list', function() {
    var result = QL.validateFavoritesImport('[]');
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /no favorites/);
  });

  test.it('rejects entries that are not objects', function() {
    var result = QL.validateFavoritesImport('["hello"]');
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /Entry 1 is not a quote object/);
  });

  test.it('rejects a non-numeric id and names the entry', function() {
    var raw = JSON.stringify([{ id: 1, text: 'A', author: 'X' }, { id: 'two', text: 'B', author: 'Y' }]);
    var result = QL.validateFavoritesImport(raw);
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /Entry 2 is missing a numeric "id"/);
  });

  test.it('rejects missing or blank text', function() {
    var result = QL.validateFavoritesImport(JSON.stringify([{ id: 1, text: '   ', author: 'X' }]));
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /missing a "text" field/);
  });

  test.it('rejects missing author', function() {
    var result = QL.validateFavoritesImport(JSON.stringify([{ id: 1, text: 'A' }]));
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /missing an "author" field/);
  });
});

test.describe('mergeFavorites', function() {
  test.it('appends only new ids and reports counts', function() {
    var existing = [{ id: 1, text: 'A', author: 'X' }];
    var incoming = [{ id: 1, text: 'A', author: 'X' }, { id: 2, text: 'B', author: 'Y' }];
    var result = QL.mergeFavorites(existing, incoming);
    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.skipped, 1);
    assert.deepStrictEqual(result.favorites.map(function(f) { return f.id; }), [1, 2]);
  });

  test.it('deduplicates repeated ids inside the incoming list', function() {
    var result = QL.mergeFavorites([], [
      { id: 5, text: 'A', author: 'X' },
      { id: 5, text: 'A', author: 'X' }
    ]);
    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.skipped, 1);
  });

  test.it('does not mutate the existing list', function() {
    var existing = [{ id: 1, text: 'A', author: 'X' }];
    QL.mergeFavorites(existing, [{ id: 2, text: 'B', author: 'Y' }]);
    assert.strictEqual(existing.length, 1);
  });
});

test.describe('filterFavorites', function() {
  var FAVS = [
    { id: 1, text: 'Stay hungry, stay foolish', author: 'Steve Jobs', category: 'motivation' },
    { id: 2, text: 'Know thyself', author: 'Socrates', category: 'wisdom' },
    { id: 3, text: 'Life is short', author: 'Seneca', category: 'life' }
  ];

  test.it('returns everything with no query and the "all" chip', function() {
    assert.strictEqual(QL.filterFavorites(FAVS, '', 'all').length, 3);
  });

  test.it('matches quote text case-insensitively', function() {
    var result = QL.filterFavorites(FAVS, 'HUNGRY', 'all');
    assert.deepStrictEqual(result.map(function(f) { return f.id; }), [1]);
  });

  test.it('matches the author', function() {
    var result = QL.filterFavorites(FAVS, 'socrates', 'all');
    assert.deepStrictEqual(result.map(function(f) { return f.id; }), [2]);
  });

  test.it('combines the query with the category chip', function() {
    assert.strictEqual(QL.filterFavorites(FAVS, 'life', 'life').length, 1);
    assert.strictEqual(QL.filterFavorites(FAVS, 'life', 'wisdom').length, 0);
  });

  test.it('ignores surrounding whitespace in the query', function() {
    assert.strictEqual(QL.filterFavorites(FAVS, '  seneca  ', 'all').length, 1);
  });

  test.it('returns an empty list when nothing matches', function() {
    assert.deepStrictEqual(QL.filterFavorites(FAVS, 'zzz', 'all'), []);
  });
});
