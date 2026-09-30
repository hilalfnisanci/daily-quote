# Daily Quote

A simple webpage displaying daily motivational quotes. Every visit picks a quote at
random from a curated collection in `quotes.json`, so the page always opens with
something new. Selection is weighted by the categories you interact with, so the
quotes you see gradually match your taste.

Quotes you like can be saved to favorites, searched, filtered by category, and moved
between browsers as a JSON file. Everything you save lives in your browser's
`localStorage` — there is no backend, no account, and no data leaves your machine.
The whole app is plain HTML, CSS, and JavaScript with no build step or dependencies,
so it runs from any static host.

## Features

- **Daily quote** — a random quote on every visit, weighted toward the categories you engage with, with a category filter.
- **Favorites** — save quotes with ♡, then search them by text or author and narrow them down with category chips.
- **Import / export** — download your favorites as JSON and load them back on another browser. Invalid files are rejected with a readable message, and quotes you already have are skipped instead of duplicated.
- **History** — every quote you see is recorded once per day in `localStorage`, kept for 30 days, and listed grouped by day under the *History* tab.
- **Copy to clipboard** — one click copies the quote text.

## Running locally

Serve the folder over HTTP (the app fetches `quotes.json`, which `file://` blocks):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. There is no build step.

## Tests

The pure logic — weighted quote selection, history recording and pruning,
favorites search, and import validation — lives in `quote-logic.js`, which loads
as a plain `<script>` in the browser and as a CommonJS module under Node. Tests
use Node's built-in test runner, so there is nothing to install:

```bash
node --test
# or
npm test
```

Run a single file:

```bash
node --test test/quote-logic.test.js
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Layout and the three tabs |
| `app.js` | DOM wiring, `localStorage` access, rendering |
| `quote-logic.js` | Pure, testable logic shared with the test suite |
| `styles.css` | All styling (dark page, light quote card) |
| `quotes.json` | Quote data (`{id, text, author}`) |
| `quotes-categories.json` | Optional id → category overrides |
| `test/` | `node --test` suite |
