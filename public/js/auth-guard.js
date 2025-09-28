// public/js/auth-guard.js
(function () {
  // Συντομεύσεις για DOM επιλογές
  const Q = (s, r = document) => r.querySelector(s);            // Πρώτο στοιχείο που ταιριάζει
  const QA = (s, r = document) => Array.from(r.querySelectorAll(s)); // Όλα τα στοιχεία που ταιριάζουν (Array)

  // Απόπειρα λήψης session χρήστη από backend
  async function getMe() {
    try { return await api('/api/auth/me'); }
    catch { return { user: null }; } // Σε αποτυχία, επιστρέφει δομή χωρίς χρήστη
  }

  // Χαρτογράφηση ρόλου -> αρχική σελίδα dashboard για τον ρόλο
  function roleDash(role) {
    if (role === 'secretary') return '/dashboard/secretary.html';
    if (role === 'mechanic') return '/dashboard/mechanic.html';
    return '/dashboard/customer.html';
  }

  // Δημιουργία αρχικών ονόματος (π.χ. "Ν Γ" από "Νίκος Γεωργίου")
  function initials(name = '') {
    const parts = (name || '').trim().split(/\s+/).slice(0, 2);
    return parts.map(s => s[0]?.toUpperCase() || '').join('');
  }

  // Έλεγχος τρέχουσας διαδρομής (pathname) με regex
  function on(pathRe) { return pathRe.test(location.pathname); }

  // Κύρια εκκίνηση/φρουρός αυθεντικοποίησης & αρχικοποίηση UI
  async function boot() {
    const meResp = await getMe();                      // Απόπειρα ανάκτησης τωρινού χρήστη
    const user = meResp && meResp.user ? meResp.user : null; // Κανονικοποίηση
    window.__ME__ = user;                              // Έκθεση στο global για άλλο κώδικα

    // Σημαίες τρέχουσας σελίδας
    const isDashboard = on(/\/dashboard\//);                  // Σε σελίδα dashboard;
    const isLoginOrRegister = on(/\/(login|register)\.html$/); // Σε login ή register;
    const isHome = on(/^\/$|\/index\.html$/);                  // Στην αρχική;

    // ===== Κανόνες ανακατεύθυνσης (redirect rules) =====
    if (user && isLoginOrRegister) return location.replace(roleDash(user.role)); // Αν έχεις login και είσαι ήδη logged-in, πήγαινε στο dashboard σου
    if (!user && isDashboard) return location.replace('/login.html');            // Αν δεν είσαι logged-in και είσαι σε dashboard, στείλε σε login

    // ===== Navbar UI (μόνο εκτός dashboard) =====
    const nav = Q('.navbar');
    if (nav && !isDashboard) {
      const loginLinks = QA('a[href="/login.html"], a[href="/register.html"]', nav); // Links login/register

      // Δημιουργία/εύρεση δεξιού container στο navbar
      let right = Q('#nav-right', nav);
      if (!right) {
        right = document.createElement('div');
        right.id = 'nav-right';
        right.className = 'nav-right';
        nav.appendChild(right);
      }

      if (user) {
        // Αν υπάρχει χρήστης: κρύψε links login/register
        loginLinks.forEach(a => a.style.display = 'none');

        // Chip χρήστη (αρχικά + κείμενο)
        let chip = Q('#nav-chip', right);
        if (!chip) {
          chip = document.createElement('div');
          chip.id = 'nav-chip';
          chip.className = 'chip';
          right.appendChild(chip);
        }
        chip.innerHTML = `
          <span class="chip-initials">${initials(user.name || user.username || 'U')}</span>
          <span class="chip-text">
            <strong>${user.name || user.username || 'Χρήστης'}</strong>
            <small>${user.role}</small>
          </span>
        `;

        // Στην ΑΡΧΙΚΗ μόνο: κουμπί "Πίνακας Ελέγχου"
        let dashBtn = Q('#nav-dash', right);
        if (isHome) {
          if (!dashBtn) {
            dashBtn = document.createElement('a');
            dashBtn.id = 'nav-dash';
            dashBtn.className = 'btn primary';
            right.appendChild(dashBtn);
          }
          dashBtn.href = roleDash(user.role);
          dashBtn.textContent = 'Πίνακας Ελέγχου';
          dashBtn.style.display = '';
        } else if (dashBtn) {
          dashBtn.style.display = 'none';
        }

        // Κουμπί "Αποσύνδεση"
        let lo = Q('#nav-logout', right);
        if (!lo) {
          lo = document.createElement('button');
          lo.id = 'nav-logout';
          lo.className = 'btn ghost';
          lo.setAttribute('data-action', 'logout');
          lo.type = 'button';
          right.appendChild(lo);
        }
        lo.textContent = 'Αποσύνδεση';

      } else {
        // Κατάσταση επισκέπτη (guest)
        loginLinks.forEach(a => a.style.display = '');        // Δείξε login/register
        const right = nav.querySelector('#nav-right'); if (right) right.remove(); // Αφαίρεση container
        const toRemove = ['#nav-chip', '#nav-dash', '#nav-logout'];               // Καθαρισμός υπολοίπων
        toRemove.forEach(sel => { const el = Q(sel, right); if (el) el.remove(); });
      }
    }

    // ===== Badge χρήστη σε dashboards (αν υπάρχει στοιχείο και έχεις user) =====
    if (isDashboard && user) {
      const who = Q('#navUser');
      if (who) who.textContent = user.name || user.username || 'Χρήστης';
    }

    // ===== Αρχική: κρύψε "Σύνδεση" όταν είσαι logged-in & καθάρισε sidebar της αρχικής =====
    if (isHome) {
      const loginBtn = Q('.hero-cta a[href="/login.html"]');
      if (loginBtn) loginBtn.style.display = user ? 'none' : '';
      const sb = Q('#homeSidebar'); if (sb) sb.remove();
      document.body.classList.remove('nav-open');
    }
  }

  // Global handler για κλικ σε "Αποσύνδεση" (οπουδήποτε στη σελίδα)
  document.addEventListener('click', async (e) => {
    const lo = e.target.closest('[data-action="logout"]');
    if (lo) {
      e.preventDefault();

      // Άμεσο καθάρισμα UI στο navbar ώστε να μην "μένουν" στοιχεία μετά το logout
      const nav = document.querySelector('.navbar');
      if (nav) {
        const right = nav.querySelector('#nav-right'); if (right) right.remove();
        nav.querySelectorAll('a[href="/login.html"], a[href="/register.html"]').forEach(a => a.style.display = '');
        const go = nav.querySelector('#nav-dash'); if (go) go.remove(); // Καθαρισμός "Πίνακας Ελέγχου"
      }

      // Κλήση logout στο API (αδιαφορία σε σφάλμα) και redirect σε login με query param
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { }
      location.replace(`/login.html?logged_out=${Date.now()}`);
    }
  });

  // Εκκίνηση guard/UI
  boot();
})();

