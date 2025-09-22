// public/js/nav-user.js
(async function(){
  try {
    const me = await api('/api/users/me');
    const el = document.getElementById('navUser');
    if (el && me) el.textContent = `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() || (me.username ?? '');
  } catch (_) {}
})();
