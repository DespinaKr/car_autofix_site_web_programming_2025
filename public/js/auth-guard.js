// /js/auth-guard.js
(async () => {
  try {
    const me = await api('/api/me');     // server διαβάζει session cookie
    window.__ME__ = me;
    const who = document.querySelector('#navUser');
    if (who) who.textContent = me.full_name || me.username || 'Χρήστης';
  } catch {
    // 401 -> redirect γίνεται ήδη από api.js
  }
})();

window.logout = async function () {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  location.href = '/login.html';
};
