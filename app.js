var currentQuote = null;
var allQuotes = [];
var activeFilter = 'all';
var viewStartTime = null;

var CATEGORIES = ['motivation', 'success', 'wisdom', 'life', 'happiness'];

var CATEGORY_KEYWORDS = {
  motivation: ['dream', 'believe', 'go', 'do', 'take', 'action', 'try', 'work', 'strike', 'can', 'persist', 'keep', 'start', 'begin'],
  success:    ['success', 'fail', 'failure', 'achieve', 'goal', 'win', 'courage', 'accomplish'],
  wisdom:     ['wisdom', 'think', 'know', 'truth', 'mind', 'limit', 'doubt', 'examine', 'learn', 'knowledge', 'understand'],
  life:       ['life', 'live', 'beauty', 'future', 'time', 'tree', 'today', 'tomorrow', 'moment'],
  happiness:  ['happy', 'happiness', 'joy', 'smile', 'love', 'peace', 'content', 'gratitude']
};

function categorizeQuote(text) {
  var lower = text.toLowerCase();
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
  var scores = (prefs && prefs.categoryScores) || {};
  var totalWeight = 0;
  var weights = quotes.map(function(q) {
    var w = 1 + ((scores[q.category] || 0) * 0.3);
    totalWeight += w;
    return w;
  });
  var rand = Math.random() * totalWeight;
  var cumulative = 0;
  for (var i = 0; i < quotes.length; i++) {
    cumulative += weights[i];
    if (rand <= cumulative) return quotes[i];
  }
  return quotes[quotes.length - 1];
}

function getFilteredQuotes() {
  if (activeFilter === 'all') return allQuotes;
  var filtered = allQuotes.filter(function(q) { return q.category === activeFilter; });
  return filtered.length > 0 ? filtered : allQuotes;
}

function displayQuote(quotes) {
  currentQuote = selectWeightedQuote(quotes);
  document.getElementById('quote-text').textContent = currentQuote.text;
  document.getElementById('quote-author').textContent = '— ' + currentQuote.author;

  var catEl = document.getElementById('quote-category');
  catEl.textContent = currentQuote.category;
  catEl.classList.remove('hidden');

  document.getElementById('loading-spinner').classList.add('hidden');
  updateHeartBtn();
  viewStartTime = Date.now();
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
  } catch (e) {
    return [];
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  } catch (e) {
    // localStorage unavailable or full
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
    favorites.push({ id: currentQuote.id, text: currentQuote.text, author: currentQuote.author });
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

function renderFavorites() {
  var favorites = getFavorites();
  var list = document.getElementById('favorites-list');
  var empty = document.getElementById('favorites-empty');

  list.innerHTML = '';

  if (favorites.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  favorites.forEach(function(quote) {
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

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });

  var viewDaily = document.getElementById('view-daily');
  var viewFavorites = document.getElementById('view-favorites');

  if (tab === 'daily') {
    viewDaily.classList.remove('hidden');
    viewFavorites.classList.add('hidden');
  } else {
    viewDaily.classList.add('hidden');
    viewFavorites.classList.remove('hidden');
    renderFavorites();
  }
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

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchTab(btn.getAttribute('data-tab'));
  });
});

window.addEventListener('beforeunload', function() {
  if (currentQuote && viewStartTime) {
    var elapsed = (Date.now() - viewStartTime) / 1000;
    if (elapsed >= 30) {
      recordCategorySignal(currentQuote.category, 1);
    }
  }
});
