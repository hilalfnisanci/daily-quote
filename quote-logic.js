// Pure, framework-free logic shared by the browser app and the node --test suite.
// Exposed as window.QuoteLogic in the browser and via module.exports under Node.
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.QuoteLogic = api;
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var CATEGORIES = ['motivation', 'success', 'wisdom', 'life', 'happiness'];

  var CATEGORY_KEYWORDS = {
    motivation: ['dream', 'believe', 'go', 'do', 'take', 'action', 'try', 'work', 'strike', 'can', 'persist', 'keep', 'start', 'begin'],
    success:    ['success', 'fail', 'failure', 'achieve', 'goal', 'win', 'courage', 'accomplish'],
    wisdom:     ['wisdom', 'think', 'know', 'truth', 'mind', 'limit', 'doubt', 'examine', 'learn', 'knowledge', 'understand'],
    life:       ['life', 'live', 'beauty', 'future', 'time', 'tree', 'today', 'tomorrow', 'moment'],
    happiness:  ['happy', 'happiness', 'joy', 'smile', 'love', 'peace', 'content', 'gratitude']
  };

  var HISTORY_RETENTION_DAYS = 30;

  function categorizeQuote(text) {
    var lower = String(text || '').toLowerCase();
    var best = 'wisdom';
    var bestScore = 0;
    CATEGORIES.forEach(function(cat) {
      var score = CATEGORY_KEYWORDS[cat].filter(function(kw) {
        return lower.indexOf(kw) !== -1;
      }).length;
      if (score > bestScore) { bestScore = score; best = cat; }
    });
    return best;
  }

  // Weighted random pick. `scores` maps category -> affinity score, `random`
  // defaults to Math.random but is injectable so tests stay deterministic.
  function selectWeightedQuote(quotes, scores, random) {
    if (!quotes || quotes.length === 0) return null;
    var categoryScores = scores || {};
    var rnd = random || Math.random;
    var totalWeight = 0;
    var weights = quotes.map(function(q) {
      var w = 1 + ((categoryScores[q.category] || 0) * 0.3);
      if (w < 0) w = 0;
      totalWeight += w;
      return w;
    });
    // Every quote was clamped to zero: no quote is preferred, so fall back to
    // a uniform pick rather than always returning the first one.
    if (totalWeight <= 0) return quotes[Math.floor(rnd() * quotes.length)] || quotes[quotes.length - 1];
    var rand = rnd() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < quotes.length; i++) {
      cumulative += weights[i];
      // Skip zero-weight quotes so a rand of exactly 0 cannot select one.
      if (weights[i] > 0 && rand <= cumulative) return quotes[i];
    }
    return quotes[quotes.length - 1];
  }

  // --- History -------------------------------------------------------------

  function toDateKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    var month = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + month + '-' + day;
  }

  function daysBetween(fromKey, toKey) {
    var a = new Date(fromKey + 'T00:00:00');
    var b = new Date(toKey + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function pruneHistory(history, todayKey, retentionDays) {
    var days = typeof retentionDays === 'number' ? retentionDays : HISTORY_RETENTION_DAYS;
    return (history || []).filter(function(entry) {
      if (!entry || !entry.date) return false;
      var age = daysBetween(entry.date, todayKey);
      return age >= 0 && age < days;
    });
  }

  // Records a quote for `now`'s day. Same quote on the same day is a no-op.
  // Returns a new array; the input is never mutated.
  function addHistoryEntry(history, quote, now, retentionDays) {
    var list = (history || []).slice();
    if (!quote || quote.id === undefined || quote.id === null) {
      return pruneHistory(list, toDateKey(now || new Date()), retentionDays);
    }
    var dateKey = toDateKey(now || new Date());
    var duplicate = list.some(function(entry) {
      return entry && entry.date === dateKey && entry.id === quote.id;
    });
    if (!duplicate) {
      list.push({
        id: quote.id,
        text: quote.text,
        author: quote.author,
        category: quote.category,
        date: dateKey,
        viewedAt: (now instanceof Date ? now : new Date(now || Date.now())).toISOString()
      });
    }
    return pruneHistory(list, dateKey, retentionDays);
  }

  // Groups entries into [{ date, entries }] sorted newest day first.
  function groupHistoryByDate(history) {
    var buckets = {};
    (history || []).forEach(function(entry) {
      if (!entry || !entry.date) return;
      if (!buckets[entry.date]) buckets[entry.date] = [];
      buckets[entry.date].push(entry);
    });
    return Object.keys(buckets).sort().reverse().map(function(date) {
      return { date: date, entries: buckets[date] };
    });
  }

  // --- Favorites: search, import/export ------------------------------------

  function filterFavorites(favorites, query, category) {
    var q = String(query || '').trim().toLowerCase();
    var cat = category || 'all';
    return (favorites || []).filter(function(f) {
      if (!f) return false;
      if (cat !== 'all' && f.category !== cat) return false;
      if (!q) return true;
      var text = String(f.text || '').toLowerCase();
      var author = String(f.author || '').toLowerCase();
      return text.indexOf(q) !== -1 || author.indexOf(q) !== -1;
    });
  }

  // Favorites saved before categories existed have no `category` field, which
  // would hide them behind every chip except "All". Fill those in using the
  // same categorizer the daily quote uses.
  function backfillFavoriteCategories(favorites, categorize) {
    var fn = categorize || categorizeQuote;
    var changed = false;
    var result = (favorites || []).map(function(f) {
      if (!f) return f;
      if (f.category && CATEGORIES.indexOf(f.category) !== -1) return f;
      changed = true;
      var copy = {};
      Object.keys(f).forEach(function(k) { copy[k] = f[k]; });
      copy.category = fn(f.text);
      return copy;
    }).filter(Boolean);
    return { favorites: result, changed: changed };
  }

  // Validates raw JSON text from an imported file.
  // Returns { ok: true, favorites: [...] } or { ok: false, error: '<human message>' }.
  function validateFavoritesImport(rawText) {
    var parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      return { ok: false, error: 'The file is not valid JSON. Please pick a file exported from Daily Quote.' };
    }
    var list = parsed;
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.favorites)) {
      list = parsed.favorites;
    }
    if (!Array.isArray(list)) {
      return { ok: false, error: 'Expected a list of favorites, but the file contains something else.' };
    }
    var cleaned = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { ok: false, error: 'Entry ' + (i + 1) + ' is not a quote object.' };
      }
      var idOk = typeof item.id === 'number' && isFinite(item.id);
      if (!idOk) {
        return { ok: false, error: 'Entry ' + (i + 1) + ' is missing a numeric "id".' };
      }
      if (typeof item.text !== 'string' || item.text.trim() === '') {
        return { ok: false, error: 'Entry ' + (i + 1) + ' is missing a "text" field.' };
      }
      if (typeof item.author !== 'string' || item.author.trim() === '') {
        return { ok: false, error: 'Entry ' + (i + 1) + ' is missing an "author" field.' };
      }
      var entry = { id: item.id, text: item.text, author: item.author };
      if (typeof item.category === 'string') entry.category = item.category;
      cleaned.push(entry);
    }
    if (cleaned.length === 0) {
      return { ok: false, error: 'The file contains no favorites to import.' };
    }
    return { ok: true, favorites: cleaned };
  }

  // Appends only quotes whose id is not already present.
  // Returns { favorites, added, skipped }.
  function mergeFavorites(existing, incoming) {
    var merged = (existing || []).slice();
    var seen = {};
    merged.forEach(function(f) { if (f) seen[f.id] = true; });
    var added = 0;
    var skipped = 0;
    (incoming || []).forEach(function(f) {
      if (!f || seen[f.id]) { skipped++; return; }
      seen[f.id] = true;
      merged.push(f);
      added++;
    });
    return { favorites: merged, added: added, skipped: skipped };
  }

  return {
    CATEGORIES: CATEGORIES,
    HISTORY_RETENTION_DAYS: HISTORY_RETENTION_DAYS,
    categorizeQuote: categorizeQuote,
    selectWeightedQuote: selectWeightedQuote,
    toDateKey: toDateKey,
    pruneHistory: pruneHistory,
    addHistoryEntry: addHistoryEntry,
    groupHistoryByDate: groupHistoryByDate,
    filterFavorites: filterFavorites,
    backfillFavoriteCategories: backfillFavoriteCategories,
    validateFavoritesImport: validateFavoritesImport,
    mergeFavorites: mergeFavorites
  };
});
