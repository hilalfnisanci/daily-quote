var currentQuote = null;

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

fetch('quotes.json')
  .then(function(response) { return response.json(); })
  .then(function(quotes) {
    currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote-text').textContent = currentQuote.text;
    document.getElementById('quote-author').textContent = '— ' + currentQuote.author;
    document.getElementById('loading-spinner').classList.add('hidden');
    updateHeartBtn();
  });

document.getElementById('copy-btn').addEventListener('click', function() {
  var text = document.getElementById('quote-text').textContent;
  navigator.clipboard.writeText(text).then(function() {
    var btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied!';
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
