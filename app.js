fetch('quotes.json')
  .then(response => response.json())
  .then(quotes => {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote-text').textContent = `"${quote.text}"`;
    document.getElementById('quote-author').textContent = `— ${quote.author}`;
  });
