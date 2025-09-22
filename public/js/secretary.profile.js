// /js/secretary.profile.js
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const btnEdit = $('#btnProfileEdit');
  const avatar = $('#profileAvatar');
  const statusEl = $('#profileStatus');
  const pwdForm = $('#pwdForm');

  const FIELD_KEYS = [
    'first_name','last_name','email','username','role','id_number','vat','user_id','status','full_name'
  ];

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
    const first = u.first_name || u.firstName || '';
    const last  = u.last_name  || u.lastName  || '';
    const full  = u.full_name  || [first,last].filter(Boolean).join(' ').trim();
    return {
      id: u.id,
      first_name: first,
      last_name: last,
      full_name: full,
      email: u.email,
      username: u.username,
      role: u.role,
      id_number: u.id_card || u.id_number || '',
      status: u.is_active ? 'ACTIVE' : 'INACTIVE',
      user_id: u.id
    };
  };

  const state = { data: null, editing: false };

  async function loadProfile(){
    try{
      const raw = await api('/api/users/me');
      const d = norm(raw);
      state.data = d;
      render(d);
    }catch(err){
      console.error('profile load error:', err);
    }
  }

  function setField(key, val){
    $$(`[data-field="${key}"]`).forEach(el=>{
      if(key==='role') val = roleLabel(val);
      if(key==='status'){ el.innerHTML = statusBadge(val); return; }
      el.textContent = (val==null || val==='') ? 'N/A' : String(val);
      el.dataset.original = el.textContent;
    });
  }

  function render(d){
    if(avatar){
      const ini = initials(d.full_name || `${d.first_name} ${d.last_name}`.trim());
      avatar.textContent = ini || '–';
    }
    if(statusEl) statusEl.innerHTML = statusBadge(d.status);
    FIELD_KEYS.forEach(k => setField(k, d[k]));
    setField('full_name', d.full_name || `${d.first_name} ${d.last_name}`.trim());
    setField('vat', d.id_number);
  }

  function enterEdit(){
    state.editing = true;
    if(btnEdit) { btnEdit.classList.remove('ghost'); btnEdit.textContent = 'Αποθήκευση'; }

    if(!$('#btnProfileCancel')){
      const cancel = document.createElement('button');
      cancel.id = 'btnProfileCancel';
      cancel.className = 'btn ghost';
      cancel.style.marginLeft = '8px';
      cancel.textContent = 'Άκυρο';
      btnEdit?.parentNode?.insertBefore(cancel, btnEdit.nextSibling);
      cancel.addEventListener('click', exitEdit);
    }

    $$('[data-field][data-editable="true"]').forEach(el=>{
      if(el.querySelector('input')) return;
      const value = (el.textContent||'').trim();
      const input = document.createElement('input');
      input.className = 'input';
      input.value = value==='N/A' ? '' : value;
      input.dataset.key = el.dataset.field;
      el.innerHTML = '';
      el.appendChild(input);
    });

    pwdForm?.classList.remove('hidden');
  }

  function exitEdit(){
    state.editing = false;
    if(btnEdit) btnEdit.textContent = 'Επεξεργασία';
    $('#btnProfileCancel')?.remove();

    $$('[data-field][data-editable="true"]').forEach(el=>{
      const inp = el.querySelector('input');
      if(!inp) return;
      const v = inp.value.trim();
      el.textContent = v || 'N/A';
      el.dataset.original = el.textContent;
    });

    pwdForm?.classList.add('hidden');
  }

  function collectPatch(){
    const patch = {};
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const key = el.dataset.field;
      const val = el.querySelector('input')?.value ?? '';
      const original = el.dataset.original ?? '';
      if((val||'') !== (original==='N/A'?'':original)) {
        // map id_number -> id_card που περιμένει το backend
        patch[key === 'id_number' ? 'id_card' : key] = val;
      }
    });
    return patch;
  }

  async function save(){
    const patch = collectPatch();
    if(Object.keys(patch).length===0){ exitEdit(); return; }

    if(patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)){
      alert('Μη έγκυρο email.'); return;
    }

    try{
      const updated = await api('/api/users/me', { method:'PATCH', body: patch });
      state.data = norm(updated);
      render(state.data);
      exitEdit();
      toast('Το προφίλ ενημερώθηκε.');
    }catch(err){
      console.error(err);
      alert(err?.error || 'Αποτυχία ενημέρωσης προφίλ.');
    }
  }

  function toast(msg){
    let t = $('.toast'); if(!t){ alert(msg); return; }
    t.textContent = msg; t.classList.remove('hidden'); t.style.opacity='1';
    setTimeout(()=>{ t.style.opacity='0'; }, 2200);
  }

  pwdForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(pwdForm);
    const current_password = (fd.get('current')||'').toString();
    const new_password = (fd.get('next')||'').toString();
    const confirm = (fd.get('confirm')||'').toString();
    if(!current_password || !new_password || !confirm){ alert('Συμπλήρωσε όλα τα πεδία.'); return; }
    if(new_password !== confirm){ alert('Οι νέοι κωδικοί δεν ταιριάζουν.'); return; }
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
  document.addEventListener('DOMContentLoaded', loadProfile);
})();
