fetch('quotes.json')
  .then(function(response) { return response.json(); })
  .then(function(quotes) {
    var quote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote-text').textContent = quote.text;
    document.getElementById('quote-author').textContent = '— ' + quote.author;
    document.getElementById('loading-spinner').classList.add('hidden');
  });
