// /js/profile.mech.js
(function () {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // helpers
  const statusBadge = (activeOrStatus) => {
    const on = typeof activeOrStatus === 'string'
      ? activeOrStatus.toUpperCase().includes('ACT')
      : !!activeOrStatus;
    return `<span class="badge ${on ? 'green' : 'orange'}">${on ? 'Ενεργός' : 'Ανενεργός'}</span>`;
  };
  const initials = (name) => {
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'ME';
  };
  function toast(msg){
    const t = $('.toast'); if (!t) { alert(msg); return; }
    t.textContent = msg; t.classList.remove('hidden'); t.style.opacity='1';
    setTimeout(()=>{ t.style.opacity='0'; }, 2000);
  }

  // normalize
  function normUser(u){
    if (!u) return null;
    const first = u.first_name || u.firstName || '';
    const last  = u.last_name  || u.lastName  || '';
    const full  = u.full_name || [first, last].filter(Boolean).join(' ').trim()
                 || u.username || 'Mechanic';
    return {
      id: u.id,
      role: u.role || u.user_role || 'mechanic',
      username: u.username || '',
      email: u.email || '',
      first_name: first,
      last_name: last,
      full_name: full,
      status: u.status || (u.is_active ? 'ACTIVE' : 'INACTIVE'),
      id_card: u.id_card || u.id_number || '',
      specialty: u.specialty || u.mechanic_specialty || '',
    };
  }

  // refs
  const btnEdit  = $('#btnProfileEdit');
  const avatar   = $('#profileAvatar');
  const statusEl = $('#profileStatus');
  const pwdForm  = $('#pwdForm');

  const FIELD_KEYS = [
    'first_name','last_name','email','username',
    'id_card','specialty','full_name','status'
  ];

  const state = { me:null, data:null, editing:false };

  // boot
  window.addEventListener('DOMContentLoaded', init);

  async function init(){
    try{
      const auth = await api('/api/auth/me');
      const me = auth?.user || auth;
      if (!me || me.role !== 'mechanic') { location.href='/login.html'; return; }
      state.me = me;

      // navbar
      const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username || 'Μηχανικός';
      const navUser = $('#navUser'); if (navUser) navUser.textContent = fullName;

      // logout
      document.addEventListener('click', async (e)=>{
        const b = e.target.closest('[data-action="logout"]'); if (!b) return;
        await api('/api/auth/logout', { method:'POST' });
        location.href='/login.html';
      });

      // profile data: merge /users/me with /auth/me to καλύψουμε ελλείψεις
      let raw = null;
      try { raw = await api('/api/users/me'); } catch {}
      const merged = { ...me, ...(raw || {}) };
      state.data = normUser(merged);
      render(state.data);

    }catch(err){
      console.error(err);
      location.href='/login.html';
    }
  }

  // render
  function setField(key, val){
    $$(`[data-field="${key}"]`).forEach(el=>{
      if (key === 'status'){ el.innerHTML = statusBadge(val); return; }
      const txt = (val == null || String(val).trim() === '') ? '—' : String(val);
      el.textContent = txt; el.dataset.original = txt;
    });
  }
  function render(d){
    if (avatar)   avatar.textContent = initials(d.full_name);
    if (statusEl) statusEl.innerHTML = statusBadge(d.status);
    FIELD_KEYS.forEach(k => setField(k, d[k]));
  }

  // edit/save
  function enterEdit(){
    state.editing = true;
    if (btnEdit){ btnEdit.textContent='Αποθήκευση'; btnEdit.classList.remove('ghost'); }
    if (!$('#btnProfileCancel')){
      const cancel = document.createElement('button');
      cancel.id = 'btnProfileCancel';
      cancel.className = 'btn ghost';
      cancel.style.marginLeft = '8px';
      cancel.textContent = 'Άκυρο';
      btnEdit?.parentNode?.insertBefore(cancel, btnEdit.nextSibling);
      cancel.addEventListener('click', exitEdit);
    }
    $$('[data-field][data-editable="true"]').forEach(el=>{
      if (el.querySelector('input')) return;
      const value = (el.textContent || '').trim();
      const input = document.createElement('input');
      input.className = 'input';
      input.value = (value === '—') ? '' : value;
      input.dataset.key = el.dataset.field;
      el.innerHTML = ''; el.appendChild(input);
    });
    pwdForm?.classList.remove('hidden');
  }

  function exitEdit(){
    state.editing = false;
    if (btnEdit) btnEdit.textContent='Επεξεργασία';
    $('#btnProfileCancel')?.remove();
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const inp = el.querySelector('input'); if (!inp) return;
      const v = inp.value.trim(); el.textContent = v || '—'; el.dataset.original = el.textContent;
    });
    pwdForm?.classList.add('hidden');
  }

  function collectPatch(){
    const patch = {};
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const k = el.dataset.field;
      const val = el.querySelector('input')?.value ?? '';
      const original = el.dataset.original ?? '';
      const origClean = (original === '—') ? '' : original;
      if (val !== origClean){
        if (k === 'id_card') { patch.id_card = val; /* patch.id_number = val; */ }
        else if (k === 'specialty') { patch.specialty = val; }
        else { patch[k] = val; } // first_name, last_name, email, username
      }
    });
    return patch;
  }

  async function save(){
    const patch = collectPatch();
    if (Object.keys(patch).length === 0){ exitEdit(); return; }

    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)){
      alert('Μη έγκυρο email.'); return;
    }

    try{
      const updated = await api('/api/users/me', { method:'PATCH', body: patch });
      state.data = normUser(updated);
      render(state.data);
      exitEdit();
      toast('Το προφίλ ενημερώθηκε.');
    }catch(err){
      console.error(err);
      alert(err?.error || 'Αποτυχία ενημέρωσης προφίλ.');
    }
  }

  // change password
  pwdForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(pwdForm);
    const current_password = String(fd.get('current') || '');
    const new_password     = String(fd.get('next') || '');
    const confirm          = String(fd.get('confirm') || '');

    if (!current_password || !new_password || !confirm){ alert('Συμπλήρωσε όλα τα πεδία.'); return; }
    if (new_password !== confirm){ alert('Οι νέοι κωδικοί δεν ταιριάζουν.'); return; }
    if (new_password.length < 8){ alert('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.'); return; }

    try{
      await api('/api/users/me/password', { method:'PATCH', body:{ current_password, new_password } });
      pwdForm.reset();
      toast('Ο κωδικός άλλαξε.');
    }catch(err){
      console.error(err);
      alert(err?.error || 'Αποτυχία αλλαγής κωδικού.');
    }
  });

  btnEdit?.addEventListener('click', ()=> state.editing ? save() : enterEdit());
})();
