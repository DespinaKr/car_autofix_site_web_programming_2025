// /js/secretary.profile.js
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Hooks
  const btnEdit = $('#btnProfileEdit');
  const avatar = $('#profileAvatar');
  const statusEl = $('#profileStatus');
  const pwdForm = $('#pwdForm');

  // Πεδία που θα προσπαθήσουμε να γεμίσουμε (αν υπάρχει element με data-field)
  const FIELD_KEYS = [
    'first_name','last_name','email','username','role','id_number','vat','user_id','status','full_name'
  ];

  const DEMO = {
    id: 'admin_001',
    first_name: 'Admin',
    last_name: 'Secretary',
    email: 'admin@garage.com',
    username: 'admin',
    role: 'secretary',
    id_number: '',
    status: 'ACTIVE'
  };

  const roleLabel = (r) => r==='secretary' ? 'Γραμματέας'
                    : r==='mechanic'   ? 'Μηχανικός'
                    : r==='customer'   ? 'Πελάτης'
                    : r || '—';

  const statusBadge = (s) => {
    const on = String(s||'').toUpperCase().includes('ACT');
    return `<span class="badge ${on?'green':'orange'}">${on?'Ενεργός':'Ανενεργός'}</span>`;
  };

  const initials = (name) => {
    const parts = String(name||'').trim().split(/\s+/).filter(Boolean);
    const [a,b] = [parts[0]?.[0], parts[1]?.[0]];
    return (a? a.toUpperCase(): '') + (b? b.toUpperCase(): '');
  };

  const norm = (u) => {
    if(!u) return null;
    const first = u.first_name || u.firstName || u.given_name || '';
    const last  = u.last_name  || u.lastName  || u.family_name || (u.surname||'');
    const full  = u.full_name  || [first,last].filter(Boolean).join(' ').trim() || u.name || '';
    return {
      id: u.id || u.user_id || u.uid,
      first_name: first,
      last_name: last,
      full_name: full,
      email: u.email,
      username: u.username || u.user_name,
      role: u.role,
      id_number: u.id_number || u.identity || u.vat || '',
      status: u.status || (u.active===false?'INACTIVE':'ACTIVE'),
      user_id: u.user_id || u.id || ''
    };
  };

  let state = { data: null, editing: false };

  async function loadProfile(){
    try{
      let raw = await api('/api/me').catch(()=>null);
      if(!raw) raw = await api('/api/profile').catch(()=>null);
      if(!raw) raw = await api('/api/users/me').catch(()=>null);

      const d = norm(raw) || norm(DEMO);
      state.data = d;
      render(d);
    }catch(err){
      const d = norm(DEMO);
      state.data = d;
      render(d);
      console.error('profile load error:', err);
    }
  }

  function setField(key, val){
    $$(`[data-field="${key}"]`).forEach(el=>{
      // ειδική μορφοποίηση
      if(key==='role') val = roleLabel(val);
      if(key==='status'){ el.innerHTML = statusBadge(val); return; }
      el.textContent = (val==null || val==='') ? 'N/A' : String(val);
      el.dataset.original = el.textContent;
    });
  }

  function render(d){
    // title/avatar/status
    if(avatar){
      const ini = initials(d.full_name || `${d.first_name} ${d.last_name}`.trim());
      avatar.textContent = ini || '–';
    }
    if(statusEl) statusEl.innerHTML = statusBadge(d.status);

    FIELD_KEYS.forEach(k => setField(k, d[k]));
    // Fallbacks
    setField('full_name', d.full_name || `${d.first_name} ${d.last_name}`.trim());
    setField('vat', d.id_number); // αν χρησιμοποιείς vat στο markup
  }

  function enterEdit(){
    state.editing = true;
    btnEdit?.classList.remove('ghost');
    if(btnEdit) btnEdit.textContent = 'Αποθήκευση';

    // Προσθέτουμε Cancel δίπλα (ελαφριά λύση χωρίς να αλλάξεις layout)
    if(!$('#btnProfileCancel')){
      const cancel = document.createElement('button');
      cancel.id = 'btnProfileCancel';
      cancel.className = 'btn ghost';
      cancel.style.marginLeft = '8px';
      cancel.textContent = 'Άκυρο';
      btnEdit?.parentNode?.insertBefore(cancel, btnEdit.nextSibling);
      cancel.addEventListener('click', exitEdit);
    }

    // Μετατρέπουμε editable πεδία σε <input>
    $$('[data-field][data-editable="true"]').forEach(el=>{
      if(el.querySelector('input')) return; // ήδη editable
      const value = (el.textContent||'').trim();
      const input = document.createElement('input');
      input.className = 'input';
      input.value = value==='N/A' ? '' : value;
      input.dataset.key = el.dataset.field;
      el.innerHTML = '';
      el.appendChild(input);
    });

    // δείξε (αν υπάρχει) τη φόρμα κωδικού
    pwdForm?.classList.remove('hidden');
  }

  function exitEdit(){
    state.editing = false;
    if(btnEdit) btnEdit.textContent = 'Επεξεργασία';
    $('#btnProfileCancel')?.remove();

    // Γυρνάμε τα inputs σε text
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const inp = el.querySelector('input');
      if(!inp){ return; }
      const v = inp.value.trim();
      el.textContent = v || 'N/A';
      el.dataset.original = el.textContent;
    });

    // κρύψε (αν υπάρχει) τη φόρμα κωδικού
    pwdForm?.classList.add('hidden');
  }

  async function save(){
    // μαζεύουμε μόνο ό,τι άλλαξε
    const patch = {};
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const key = el.dataset.field;
      const val = el.querySelector('input')?.value ?? '';
      const original = el.dataset.original ?? '';
      if((val||'') !== (original==='N/A'?'':original)) patch[key] = val;
    });

    // τίποτα να στείλω
    if(Object.keys(patch).length===0){ exitEdit(); return; }

    // μικρά validations
    if(patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)){
      alert('Μη έγκυρο email.'); return;
    }

    try{
      const me = state.data || {};
      // προσπάθησε /api/me, αλλιώς users/:id
      let ok = false;
      try{ await api('/api/me', {method:'PATCH', body:patch}); ok=true; }catch{}
      if(!ok && me.id){ await api(`/api/users/${encodeURIComponent(me.id)}`, {method:'PATCH', body:patch}); }

      // ανανέωση από server για σιγουριά
      await loadProfile();
      exitEdit();
      toast('Το προφίλ ενημερώθηκε.');
    }catch(err){
      console.error(err);
      alert('Αποτυχία ενημέρωσης προφίλ.');
    }
  }

  // απλό toast αν υπάρχει .toast στο DOM, αλλιώς alert fallback
  function toast(msg){
    let t = $('.toast');
    if(!t){ alert(msg); return; }
    t.textContent = msg; t.style.opacity = '1';
    setTimeout(()=> t.style.opacity='0', 2200);
  }

  // Password change (προαιρετικό, μόνο αν υπάρχει το form στο DOM)
  pwdForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(pwdForm);
    const current = (fd.get('current')||'').toString();
    const next = (fd.get('next')||'').toString();
    const confirm = (fd.get('confirm')||'').toString();
    if(!current || !next || !confirm){ alert('Συμπλήρωσε όλα τα πεδία.'); return; }
    if(next !== confirm){ alert('Ο νέος κωδικός δεν ταιριάζει.'); return; }
    try{
      let ok=false;
      try{ await api('/api/me/password', {method:'POST', body:{current, next}}); ok=true; }catch{}
      if(!ok && state.data?.id){
        await api(`/api/users/${encodeURIComponent(state.data.id)}/password`, {method:'POST', body:{current, next}});
      }
      toast('Ο κωδικός άλλαξε.');
      pwdForm.reset();
    }catch(err){
      console.error(err);
      alert('Αποτυχία αλλαγής κωδικού.');
    }
  });

  // events
  btnEdit?.addEventListener('click', ()=>{
    if(!state.editing) enterEdit(); else save();
  });

  document.addEventListener('DOMContentLoaded', loadProfile);
})();
