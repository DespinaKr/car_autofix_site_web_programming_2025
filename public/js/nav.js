
(function () {
  // Αν ποτέ το ανεβάσεις σε υποφάκελο, βάλε π.χ. window.__APP_BASE__ = '/autofix/';
  var base = (window.__APP_BASE__ || '/').replace(/\/?$/, '/');
  var homeUrl = new URL(base + 'index.html', window.location.origin).href;

  // Πιάσε όλα τα brand links (να δουλεύει παντού: login, register, dashboard, κ.λπ.)
  var brands = document.querySelectorAll('.navbar .brand');
  brands.forEach(function (a) {
    a.setAttribute('href', homeUrl);
    a.addEventListener('click', function (e) {
      e.preventDefault();
      // Αληθινό navigation (όχι SPA/pjax): φεύγει από την τωρινή σελίδα 100%
      window.location.assign(homeUrl);
    });
  });
})();

