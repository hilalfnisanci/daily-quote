var QL = window.QuoteLogic;

var currentQuote = null;
var allQuotes = [];
var activeFilter = 'all';
var viewStartTime = null;
var favoritesSearch = '';
var favoritesCategory = 'all';

var CATEGORIES = QL.CATEGORIES;

function categorizeQuote(text) {
  return QL.categorizeQuote(text);
}

function getPreferences() {
  try {
    return JSON.parse(localStorage.getItem('quotePreferences') || '{}');
  } catch(e) { return {}; }
}

function savePreferences(prefs) {
  try { localStorage.setItem('quotePreferences', JSON.stringify(prefs)); } catch(e) {}
}

function recordCategorySignal(category, delta) {
  var prefs = getPreferences();
  if (!prefs.categoryScores) prefs.categoryScores = {};
  prefs.categoryScores[category] = (prefs.categoryScores[category] || 0) + delta;
  savePreferences(prefs);
}

function selectWeightedQuote(quotes) {
  var prefs = getPreferences();
  return QL.selectWeightedQuote(quotes, (prefs && prefs.categoryScores) || {});
}

function getFilteredQuotes() {
  if (activeFilter === 'all') return allQuotes;
  var filtered = allQuotes.filter(function(q) { return q.category === activeFilter; });
  return filtered.length > 0 ? filtered : allQuotes;
}

// --- History ---------------------------------------------------------------

function getHistory() {
  try {
    var parsed = JSON.parse(localStorage.getItem('quoteHistory') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(history) {
  try { localStorage.setItem('quoteHistory', JSON.stringify(history)); } catch (e) {}
}

function recordHistory(quote) {
  saveHistory(QL.addHistoryEntry(getHistory(), quote, new Date()));
}

function formatHistoryDate(dateKey) {
  var d = new Date(dateKey + 'T00:00:00');
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderHistory() {
  var groups = QL.groupHistoryByDate(getHistory());
  var container = document.getElementById('history-groups');
  var empty = document.getElementById('history-empty');

  container.innerHTML = '';

  if (groups.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  groups.forEach(function(group) {
    var section = document.createElement('section');
    section.className = 'history-group';

    var heading = document.createElement('h3');
    heading.className = 'history-date';
    heading.textContent = formatHistoryDate(group.date);
    section.appendChild(heading);

    var ul = document.createElement('ul');
    ul.className = 'history-list';
    group.entries.forEach(function(entry) {
      var li = document.createElement('li');
      li.className = 'history-item';

      var textEl = document.createElement('p');
      textEl.className = 'history-text';
      textEl.textContent = entry.text;

      var authorEl = document.createElement('p');
      authorEl.className = 'history-author';
      authorEl.textContent = '— ' + entry.author;

      li.appendChild(textEl);
      li.appendChild(authorEl);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    container.appendChild(section);
  });
}

function displayQuote(quotes) {
  currentQuote = selectWeightedQuote(quotes);
  if (!currentQuote) return;
  document.getElementById('quote-text').textContent = currentQuote.text;
  document.getElementById('quote-author').textContent = '— ' + currentQuote.author;

  var catEl = document.getElementById('quote-category');
  catEl.textContent = currentQuote.category;
  catEl.classList.remove('hidden');

  document.getElementById('loading-spinner').classList.add('hidden');
  updateHeartBtn();
  recordHistory(currentQuote);
  viewStartTime = Date.now();
}

// --- Favorites -------------------------------------------------------------

function getFavorites() {
  try {
    var parsed = JSON.parse(localStorage.getItem('favorites') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem('favorites', JSON.stringify(favorites));
    return true;
  } catch (e) {
    return false;
  }
}

function isFavorited(quote) {
  var favorites = getFavorites();
  return favorites.some(function(f) { return f.id === quote.id; });
}

function updateHeartBtn() {
  var btn = document.getElementById('heart-btn');
  if (!currentQuote) return;
  if (isFavorited(currentQuote)) {
    btn.textContent = '♥';
    btn.classList.add('favorited');
    btn.setAttribute('aria-label', 'Remove from favorites');
  } else {
    btn.textContent = '♡';
    btn.classList.remove('favorited');
    btn.setAttribute('aria-label', 'Add to favorites');
  }
}

function toggleFavorite() {
  if (!currentQuote) return;
  var favorites = getFavorites();
  var index = -1;
  for (var i = 0; i < favorites.length; i++) {
    if (favorites[i].id === currentQuote.id) {
      index = i;
      break;
    }
  }
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push({
      id: currentQuote.id,
      text: currentQuote.text,
      author: currentQuote.author,
      category: currentQuote.category
    });
  }
  saveFavorites(favorites);
  updateHeartBtn();
}

function removeFavorite(id) {
  var favorites = getFavorites();
  favorites = favorites.filter(function(f) { return f.id !== id; });
  saveFavorites(favorites);
  renderFavorites();
  updateHeartBtn();
}

function setTransferStatus(message, isError) {
  var el = document.getElementById('import-status');
  el.textContent = message || '';
  el.classList.toggle('error', !!isError);
  el.classList.toggle('hidden', !message);
}

// Chips are built once; later renders only refresh the active state so a chip
// (or the search box) never loses keyboard focus mid-interaction.
function renderCategoryChips() {
  var container = document.getElementById('favorites-chips');
  if (container.childElementCount > 0) {
    Array.prototype.forEach.call(container.children, function(chip) {
      var active = chip.dataset.category === favoritesCategory;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    return;
  }
  var options = ['all'].concat(CATEGORIES);
  options.forEach(function(cat) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (favoritesCategory === cat ? ' active' : '');
    chip.dataset.category = cat;
    chip.textContent = cat === 'all' ? 'All' : cat;
    chip.setAttribute('aria-pressed', favoritesCategory === cat ? 'true' : 'false');
    chip.addEventListener('click', function() {
      favoritesCategory = cat;
      renderFavorites();
    });
    container.appendChild(chip);
  });
}

function renderFavorites() {
  var favorites = getFavorites();
  // Migrate legacy favorites that predate the category field, then persist so
  // the work happens only once.
  var backfilled = QL.backfillFavoriteCategories(favorites);
  if (backfilled.changed) {
    favorites = backfilled.favorites;
    saveFavorites(favorites);
  }
  var visible = QL.filterFavorites(favorites, favoritesSearch, favoritesCategory);
  var list = document.getElementById('favorites-list');
  var empty = document.getElementById('favorites-empty');

  renderCategoryChips();
  list.innerHTML = '';

  if (visible.length === 0) {
    empty.textContent = favorites.length === 0
      ? 'No favorites yet. Click ♡ on a quote to save it here.'
      : 'No favorites match your search.';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  visible.forEach(function(quote) {
    var li = document.createElement('li');
    li.className = 'favorite-item';

    var removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove from favorites');
    removeBtn.addEventListener('click', function() { removeFavorite(quote.id); });

    var textEl = document.createElement('p');
    textEl.className = 'favorite-text';
    textEl.textContent = quote.text;

    var authorEl = document.createElement('p');
    authorEl.className = 'favorite-author';
    authorEl.textContent = '— ' + quote.author;

    li.appendChild(removeBtn);
    li.appendChild(textEl);
    li.appendChild(authorEl);
    list.appendChild(li);
  });
}

function exportFavorites() {
  var favorites = getFavorites();
  if (favorites.length === 0) {
    setTransferStatus('There are no favorites to export yet.', true);
    return;
  }
  var blob = new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'daily-quote-favorites.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setTransferStatus('Exported ' + favorites.length + ' favorite(s).', false);
}

function importFavoritesFromText(rawText) {
  var result = QL.validateFavoritesImport(rawText);
  if (!result.ok) {
    setTransferStatus(result.error, true);
    return;
  }
  var merged = QL.mergeFavorites(getFavorites(), result.favorites);
  if (!saveFavorites(merged.favorites)) {
    setTransferStatus('Could not save the imported favorites: browser storage is full or unavailable.', true);
    return;
  }
  renderFavorites();
  updateHeartBtn();
  setTransferStatus('Imported ' + merged.added + ' new favorite(s), skipped ' + merged.skipped + ' duplicate(s).', false);
}

function handleImportFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() { importFavoritesFromText(String(reader.result)); };
  reader.onerror = function() { setTransferStatus('The file could not be read.', true); };
  reader.readAsText(file);
}

// --- Tabs ------------------------------------------------------------------

var VIEWS = { daily: 'view-daily', favorites: 'view-favorites', history: 'view-history' };

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });

  Object.keys(VIEWS).forEach(function(key) {
    document.getElementById(VIEWS[key]).classList.toggle('hidden', key !== tab);
  });

  if (tab === 'favorites') renderFavorites();
  if (tab === 'history') renderHistory();
}

Promise.all([
  fetch('quotes.json').then(function(r) { return r.json(); }),
  fetch('quotes-categories.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
]).then(function(results) {
  var quotes = results[0];
  var categoryMap = results[1];

  quotes.forEach(function(q) {
    q.category = categoryMap[String(q.id)] || categorizeQuote(q.text);
  });

  allQuotes = quotes;
  displayQuote(getFilteredQuotes());
});

document.getElementById('category-select').addEventListener('change', function() {
  activeFilter = this.value;
  document.getElementById('loading-spinner').classList.remove('hidden');
  document.getElementById('quote-category').classList.add('hidden');
  displayQuote(getFilteredQuotes());
});

document.getElementById('copy-btn').addEventListener('click', function() {
  var text = document.getElementById('quote-text').textContent;
  navigator.clipboard.writeText(text).then(function() {
    var btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied!';
    if (currentQuote) {
      recordCategorySignal(currentQuote.category, 2);
    }
    setTimeout(function() {
      btn.textContent = 'Copy to clipboard';
    }, 2000);
  });
});

document.getElementById('heart-btn').addEventListener('click', toggleFavorite);

document.getElementById('favorites-search').addEventListener('input', function() {
  favoritesSearch = this.value;
  renderFavorites();
});

document.getElementById('export-btn').addEventListener('click', exportFavorites);

document.getElementById('import-btn').addEventListener('click', function() {
  document.getElementById('import-input').click();
});

document.getElementById('import-input').addEventListener('change', function() {
  handleImportFile(this.files && this.files[0]);
  this.value = '';
});

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchTab(btn.getAttribute('data-tab'));
  });
});

document.getElementById('footer-year').textContent = new Date().getFullYear();

window.addEventListener('beforeunload', function() {
  if (currentQuote && viewStartTime) {
    var elapsed = (Date.now() - viewStartTime) / 1000;
    if (elapsed >= 30) {
      recordCategorySignal(currentQuote.category, 1);
    }
  }
});
