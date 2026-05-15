# Implementation Plan: Auto-Categorization and Smart Quote Filtering (#39)

## Summary

Add keyword-based category assignment for all quotes, a category badge on each displayed quote, passive preference learning via localStorage (copy events and view duration), weighted random quote selection that gradually surfaces preferred categories, and an optional category filter dropdown — all without a build step, using the existing vanilla JS/CSS stack.

---

## Scope and Assumptions

- **In scope**: categorization data file, category badge UI, preference tracking in localStorage, weighted quote selection, category filter control, graceful degradation when localStorage is unavailable.
- **Out of scope**: server-side processing, user accounts, backend APIs, breaking changes to the existing favorites feature.
- **Assumptions**:
  - Categories are fixed: `motivation`, `success`, `wisdom`, `life`, `happiness`.
  - A quote belongs to exactly one category (primary category only).
  - The categorization of the 12 existing quotes is done manually in the plan and baked into `quotes-categories.json`; future quotes are categorized at runtime by the keyword algorithm.
  - View-time tracking uses the `beforeunload` event (fires when the tab/page closes or navigates away).
  - The filter state is not persisted across sessions (reset to "All" each visit).

---

## Affected Areas

| File | Change Type | Summary |
|---|---|---|
| `quotes-categories.json` | **New** | Static category mapping for all quotes (`{id: category}`) |
| `quotes.json` | **None** | Untouched; category merged at runtime from the new file |
| `app.js` | **Modified** | Categorization algorithm, merged fetch, preference tracking, weighted selection, filter logic |
| `index.html` | **Modified** | Category badge element, filter `<select>` dropdown |
| `styles.css` | **Modified** | Badge and filter styles |

---

## Technical Design

### 1. Data: `quotes-categories.json`

A flat JSON object keyed by quote ID (string) to category name (string). This is the authoritative source of categories for all manually-curated quotes. New quotes that appear without an entry here fall back to the runtime keyword algorithm.

```json
{
  "1": "motivation",
  "2": "wisdom",
  "3": "motivation",
  "4": "life",
  "5": "success",
  "6": "motivation",
  "7": "motivation",
  "8": "wisdom",
  "9": "motivation",
  "10": "wisdom",
  "11": "life",
  "12": "life"
}
```

**Manual category rationale:**

| ID | Key theme | Category |
|---|---|---|
| 1 | doing great work / love what you do | motivation |
| 2 | finding opportunity in difficulty | wisdom |
| 3 | persistence / keep going | motivation |
| 4 | dreams / future | life |
| 5 | success, failure, courage | success |
| 6 | taking chances / action | motivation |
| 7 | self-belief | motivation |
| 8 | limits / doubts | wisdom |
| 9 | action / initiative | motivation |
| 10 | mindset / thinking | wisdom |
| 11 | timing / now | life |
| 12 | examined life / philosophy | life |

### 2. Keyword Categorization Algorithm (runtime fallback)

Used for any quote not found in `quotes-categories.json`. Score each category by counting keyword hits in the lowercased quote text; return the highest-scoring category, defaulting to `wisdom` on a tie or zero match.

```
CATEGORY_KEYWORDS = {
  motivation: ['dream', 'believe', 'go', 'do', 'take', 'action', 'try', 'work',
               'strike', 'can', 'persist', 'keep', 'start', 'begin'],
  success:    ['success', 'fail', 'failure', 'achieve', 'goal', 'win', 'courage',
               'accomplish'],
  wisdom:     ['wisdom', 'think', 'know', 'truth', 'mind', 'limit', 'doubt',
               'examine', 'learn', 'knowledge', 'understand'],
  life:       ['life', 'live', 'beauty', 'future', 'time', 'tree', 'today',
               'tomorrow', 'moment'],
  happiness:  ['happy', 'happiness', 'joy', 'smile', 'love', 'peace', 'content',
               'gratitude']
}
```

Function signature: `categorizeQuote(text)` → category string.

### 3. localStorage Schema

Key: `quotePreferences`

```json
{
  "categoryScores": {
    "motivation": 0,
    "success": 0,
    "wisdom": 0,
    "life": 0,
    "happiness": 0
  }
}
```

`categoryScores` accumulates implicit signals:
- **+2** when the user copies a quote (strong positive signal).
- **+1** when the user has viewed a quote for ≥30 seconds (passive interest signal).

Helper functions:
- `getPreferences()` — reads and parses `quotePreferences` from localStorage; returns `{}` on error.
- `savePreferences(prefs)` — writes to localStorage; swallows errors silently (graceful degradation).
- `recordCategorySignal(category, delta)` — reads prefs, increments the score, saves back.

### 4. Weighted Random Selection

Given the full (or filtered) quote list, compute a weight for each quote:

```
weight(quote) = 1 + (categoryScores[quote.category] * 0.3)
```

The `0.3` multiplier keeps weights reasonable even after many interactions (a score of 10 → weight 4, never dominates completely). Then do a weighted random pick by summing weights, generating `Math.random() * totalWeight`, and walking the list.

Function signature: `selectWeightedQuote(quotes)` → quote object. Falls back to uniform random if preference loading fails.

### 5. View-Time Tracking

- Record `viewStartTime = Date.now()` immediately after a quote is displayed.
- In a `window.addEventListener('beforeunload', ...)` handler, compute elapsed seconds. If ≥ 30s and a quote is showing, call `recordCategorySignal(currentQuote.category, 1)`.

### 6. Category Filter Dropdown

A `<select>` element with options `All`, `Motivation`, `Success`, `Wisdom`, `Life`, `Happiness`. Placed below `#daily-header` in the DOM (above the quote text). Default value: `All`.

Behavior:
- Changing the filter re-runs `selectWeightedQuote` on the filtered subset of quotes.
- If the filtered subset is empty (no quotes in that category), show all quotes instead.
- Filter state is stored in a JS variable; it resets to `All` on each page load.

### 7. Category Badge

A `<span id="quote-category">` element inserted between `#quote-text` and `#quote-author` in `index.html`. Displays the category name as a small pill (e.g., `wisdom`). Hidden by `hidden` class until quote loads.

---

## Implementation Steps

### Step 1 — Create `quotes-categories.json`

Create the file at the project root with the 12-quote mapping shown in the Technical Design section above.

### Step 2 — Add HTML elements (`index.html`)

Inside `#view-daily`:

1. After `#daily-header`, add:
   ```html
   <div id="category-filter">
     <label for="category-select" class="sr-only">Filter by category</label>
     <select id="category-select">
       <option value="all">All categories</option>
       <option value="motivation">Motivation</option>
       <option value="success">Success</option>
       <option value="wisdom">Wisdom</option>
       <option value="life">Life</option>
       <option value="happiness">Happiness</option>
     </select>
   </div>
   ```

2. Between `<p id="quote-text">` and `<p id="quote-author">`, add:
   ```html
   <span id="quote-category" class="hidden"></span>
   ```

### Step 3 — Add CSS (`styles.css`)

```css
/* Visually-hidden label for accessibility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

/* Category filter row */
#category-filter {
  margin-bottom: 1rem;
  text-align: right;
}

#category-select {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  background: #f9f9f9;
  color: #555;
  cursor: pointer;
}

/* Category badge */
#quote-category {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.15rem 0.5rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  background: #f0f0f0;
  color: #555;
}
```

### Step 4 — Rewrite `app.js` logic

Preserve all existing favorites/tab logic. Extend the JS with these additions (order matters for clarity):

**4a. Constants**

```javascript
var CATEGORIES = ['motivation', 'success', 'wisdom', 'life', 'happiness'];

var CATEGORY_KEYWORDS = {
  motivation: ['dream','believe','go','do','take','action','try','work','strike','can','persist','keep','start','begin'],
  success:    ['success','fail','failure','achieve','goal','win','courage','accomplish'],
  wisdom:     ['wisdom','think','know','truth','mind','limit','doubt','examine','learn','knowledge','understand'],
  life:       ['life','live','beauty','future','time','tree','today','tomorrow','moment'],
  happiness:  ['happy','happiness','joy','smile','love','peace','content','gratitude']
};
```

**4b. Categorization function**

```javascript
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
```

**4c. Preference helpers**

```javascript
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
```

**4d. Weighted selection**

```javascript
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
```

**4e. View-time tracking variables**

```javascript
var viewStartTime = null;
```

**4f. Update the fetch block**

Replace the single `fetch('quotes.json')` call with a `Promise.all` that also fetches `quotes-categories.json`, merges category data, and wires up the filter:

```javascript
var allQuotes = [];
var activeFilter = 'all';

Promise.all([
  fetch('quotes.json').then(function(r) { return r.json(); }),
  fetch('quotes-categories.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
]).then(function(results) {
  var quotes = results[0];
  var categoryMap = results[1];

  // Merge category data
  quotes.forEach(function(q) {
    q.category = categoryMap[String(q.id)] || categorizeQuote(q.text);
  });

  allQuotes = quotes;
  displayQuote(getFilteredQuotes());
});
```

**4g. `getFilteredQuotes` and `displayQuote`**

```javascript
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
```

**4h. Category filter event listener**

```javascript
document.getElementById('category-select').addEventListener('change', function() {
  activeFilter = this.value;
  document.getElementById('loading-spinner').classList.remove('hidden');
  document.getElementById('quote-category').classList.add('hidden');
  displayQuote(getFilteredQuotes());
});
```

**4i. Update copy button to record preference signal**

Inside the copy button click handler, after the `navigator.clipboard.writeText` call succeeds, add:
```javascript
if (currentQuote) {
  recordCategorySignal(currentQuote.category, 2);
}
```

**4j. View-time tracking on unload**

```javascript
window.addEventListener('beforeunload', function() {
  if (currentQuote && viewStartTime) {
    var elapsed = (Date.now() - viewStartTime) / 1000;
    if (elapsed >= 30) {
      recordCategorySignal(currentQuote.category, 1);
    }
  }
});
```

---

## Validation Strategy

### Manual Testing

1. **Category display**: Reload the page several times and verify a small category badge appears below the quote text on every load.
2. **Filter dropdown**:
   - Select "Wisdom" → reload several times (by changing filter and back) and confirm only wisdom quotes appear.
   - Select a category with no quotes (e.g., "Happiness" once quotes.json is checked) → confirm app falls back to all quotes gracefully.
3. **Preference learning**:
   - Open DevTools → Application → localStorage. Verify `quotePreferences` key is absent initially.
   - Click "Copy to clipboard" → verify `quotePreferences.categoryScores[<category>]` increments by 2.
   - Stay on a quote for >30 seconds, navigate away, return → verify the score for that category incremented by 1 (check localStorage before and after).
4. **Weighted selection**: After copying a quote several times in the "Wisdom" category, refresh repeatedly and verify wisdom quotes appear more often than others (statistical, not deterministic).
5. **Graceful degradation**: In DevTools, disable localStorage (Application > Storage > Clear site data). Reload the page and verify it still displays a quote, the badge shows, the filter works — no JS errors in console.
6. **Favorites tab**: Verify that the existing favorites feature still works completely.
7. **`quotes-categories.json` fetch failure**: Test with the network tab blocking `quotes-categories.json`. Verify the app falls back to the keyword categorization algorithm (`.catch(function() { return {}; })`).

### JSON Validation

- Validate `quotes-categories.json` is valid JSON and all 12 quote IDs (1–12) have entries.

### Edge Cases

- A quote whose text matches no keywords → defaults to `wisdom`.
- `localStorage` full or unavailable → preference functions catch errors silently; selection falls back to uniform random (weight = 1 for all).
- `quotes-categories.json` fetch fails → `.catch` returns `{}`, all quotes use keyword fallback.
- Filtered category with no matching quotes → `getFilteredQuotes` returns full `allQuotes`.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `beforeunload` fires unreliably on mobile | Medium | Acceptable; view-time tracking is a nice-to-have; copy signal is the primary mechanism |
| Category badge disrupts layout on narrow screens | Low | Badge is `display: inline-block` inside paragraph flow; test at 320px width |
| Weighted selection creates very uneven distributions after many copies | Low | Weight formula caps effect: 0.3 multiplier means even score=20 gives weight=7 (not overwhelming) |
| `Promise.all` rejection if `quotes.json` fails | Low | Already unhandled in the original code; add `.catch` to the outer chain to show an error message |
| Existing `toggleFavorite` stores `{id, text, author}` without `category` | None | Favorites are stored without category; that's fine — favorites display does not need the category |

---

## Success Criteria

- All 12 quotes have a category assigned and display a badge when shown.
- Changing the filter dropdown shows only quotes from the selected category.
- Copying a quote visibly increments the corresponding `categoryScores` entry in localStorage.
- Viewing a quote for ≥30 seconds before navigating away increments the score by 1.
- App loads and functions correctly with localStorage blocked (no JS errors, quotes still display).
- Existing favorites and tab-switching behavior is unaffected.
