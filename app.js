fetch('quotes.json')
  .then(function(response) { return response.json(); })
  .then(function(quotes) {
    var quote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote-text').textContent = quote.text;
    document.getElementById('quote-author').textContent = '— ' + quote.author;
    document.getElementById('loading-spinner').classList.add('hidden');
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
