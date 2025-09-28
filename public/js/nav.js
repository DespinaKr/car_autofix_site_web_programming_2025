(function () {
  // Αν ποτέ το ανεβάσεις σε υποφάκελο, όρισε window.__APP_BASE__ (π.χ. '/autofix/').
  // Το base πάντα καταλήγει σε '/', π.χ. '/' ή '/autofix/'.
  var base = (window.__APP_BASE__ || '/').replace(/\/?$/, '/');

  // Απόλυτο URL της αρχικής σελίδας (index.html) με βάση το base και το origin
  var homeUrl = new URL(base + 'index.html', window.location.origin).href;

  // Βρες όλα τα links με κλάση .brand μέσα στη .navbar (υπάρχει σε login, register, dashboard κλπ)
  var brands = document.querySelectorAll('.navbar .brand');

  // Για κάθε brand link:
  brands.forEach(function (a) {
    // Ρύθμισε το href να δείχνει πάντα στην αρχική (homeUrl)
    a.setAttribute('href', homeUrl);

    // Κατά το κλικ κάνε πλήρες navigation (όχι SPA/pjax)
    a.addEventListener('click', function (e) {
      e.preventDefault();                 // Μην ακολουθήσει το default του browser στο href
      window.location.assign(homeUrl);    // Πλήρης μετάβαση στη home (φορτώνει εκ νέου τη σελίδα)
    });
  });
})();


