// public/js/auth-guard.js
(function () {
  const Q = (s, r = document) => r.querySelector(s);
  const QA = (s, r = document) => Array.from(r.querySelectorAll(s));

  async function getMe() {
    try { return await api('/api/auth/me'); }
    catch { return { user: null }; }
  }

  function roleDash(role) {
    if (role === 'secretary') return '/dashboard/secretary.html';
    if (role === 'mechanic') return '/dashboard/mechanic.html';
    return '/dashboard/customer.html';
  }

  function initials(name = '') {
    const parts = (name || '').trim().split(/\s+/).slice(0, 2);
    return parts.map(s => s[0]?.toUpperCase() || '').join('');
  }

  function on(pathRe) { return pathRe.test(location.pathname); }

  async function boot() {
    const meResp = await getMe();
    const user = meResp && meResp.user ? meResp.user : null;
    window.__ME__ = user;

    const isDashboard = on(/\/dashboard\//);
    const isLoginOrRegister = on(/\/(login|register)\.html$/);
    const isHome = on(/^\/$|\/index\.html$/);

    // ===== Redirect rules =====
    if (user && isLoginOrRegister) return location.replace(roleDash(user.role));
    if (!user && isDashboard) return location.replace('/login.html');

    // ===== Navbar UI (όχι στα dashboards) =====
    const nav = Q('.navbar');
    if (nav && !isDashboard) {
      const loginLinks = QA('a[href="/login.html"], a[href="/register.html"]', nav);

      // container δεξιά, για να μαζεύουν όλα (chip + buttons)
      let right = Q('#nav-right', nav);
      if (!right) {
        right = document.createElement('div');
        right.id = 'nav-right';
        right.className = 'nav-right';
        nav.appendChild(right);
      }

      if (user) {
        loginLinks.forEach(a => a.style.display = 'none');

        // user chip
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

        // στην ΑΡΧΙΚΗ μόνο: κουμπί Πίνακας Ελέγχου
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

        // κουμπί Αποσύνδεση (ghost)
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
        // guest
        loginLinks.forEach(a => a.style.display = '');
        const right = nav.querySelector('#nav-right'); if (right) right.remove();
        const toRemove = ['#nav-chip', '#nav-dash', '#nav-logout'];
        toRemove.forEach(sel => { const el = Q(sel, right); if (el) el.remove(); });
      }
    }

    // ===== badge χρήστη στα dashboards (αν υπάρχει) =====
    if (isDashboard && user) {
      const who = Q('#navUser');
      if (who) who.textContent = user.name || user.username || 'Χρήστης';
    }

    // ===== Home: κρύψε "Σύνδεση" και μην φτιάχνεις sidebar =====
    if (isHome) {
      const loginBtn = Q('.hero-cta a[href="/login.html"]');
      if (loginBtn) loginBtn.style.display = user ? 'none' : '';
      const sb = Q('#homeSidebar'); if (sb) sb.remove();
      document.body.classList.remove('nav-open');
    }
  }

  document.addEventListener('click', async (e) => {
    const lo = e.target.closest('[data-action="logout"]');
    if (lo) {
      e.preventDefault();

      // --- ΑΜΕΣΟ UI cleanup για να μη "χαλάει" μετά το logout
      const nav = document.querySelector('.navbar');
      if (nav) {
        const right = nav.querySelector('#nav-right'); if (right) right.remove();
        nav.querySelectorAll('a[href="/login.html"], a[href="/register.html"]').forEach(a => a.style.display = '');
        // καθάρισε τυχόν κουμπί "Πίνακας Ελέγχου"
        const go = nav.querySelector('#nav-dash'); if (go) go.remove();
      }

      try { await api('/api/auth/logout', { method: 'POST' }); } catch { }
      location.replace(`/login.html?logged_out=${Date.now()}`);
    }
  });


  boot();
})();
