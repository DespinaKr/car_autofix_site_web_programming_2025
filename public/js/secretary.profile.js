// /js/secretary.profile.js
(function () {
  // Μικρές συντομεύσεις για επιλογές DOM
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Σταθερές αναφορές σε στοιχεία της σελίδας (κουμπιά/πεδία)
  const btnEdit = $('#btnProfileEdit');
  const avatar = $('#profileAvatar');
  const statusEl = $('#profileStatus');
  const pwdForm = $('#pwdForm');

  // Λίστα κλειδιών που αναμένουμε να εμφανίζονται ως data-field στο HTML
  const FIELD_KEYS = [
    'first_name','last_name','email','username','role','id_number','vat','user_id','status','full_name'
  ];

  // Μεταφράσεις ρόλων για εμφάνιση
  const roleLabel = (r) => r==='secretary' ? 'Γραμματέας'
                    : r==='mechanic'   ? 'Μηχανικός'
                    : r==='customer'   ? 'Πελάτης'
                    : r || '—';

  // Badge κατάστασης (ενεργός/ανενεργός) με χρώμα
  const statusBadge = (s) => {
    const on = String(s||'').toUpperCase().includes('ACT');
    return `<span class="badge ${on?'green':'orange'}">${on?'Ενεργός':'Ανενεργός'}</span>`;
  };

  // Υπολογισμός αρχικών (initials) από ονοματεπώνυμο
  const initials = (name) => {
    const parts = String(name||'').trim().split(/\s+/).filter(Boolean);
    const [a,b] = [parts[0]?.[0], parts[1]?.[0]];
    return (a? a.toUpperCase(): '') + (b? b.toUpperCase(): '');
  };

  // Κανονικοποίηση αντικειμένου χρήστη σε ενιαία μορφή για το UI
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

  // Τοπική κατάσταση view
  const state = { data: null, editing: false };

  // Φόρτωση προφίλ γραμματέα από το backend και αρχικό render
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

  // Θέτει την τιμή όλων των στοιχείων με ίδιο data-field
  function setField(key, val){
    $$(`[data-field="${key}"]`).forEach(el=>{
      if(key==='role') val = roleLabel(val);           // ετικέτα ρόλου
      if(key==='status'){ el.innerHTML = statusBadge(val); return; } // badge κατάστασης
      el.textContent = (val==null || val==='') ? 'N/A' : String(val);
      el.dataset.original = el.textContent;            // αποθήκευση αρχικής τιμής για σύγκριση
    });
  }

  // Απόδοση δεδομένων χρήστη στο UI (avatar/status/πεδία)
  function render(d){
    if(avatar){
      const ini = initials(d.full_name || `${d.first_name} ${d.last_name}`.trim());
      avatar.textContent = ini || '–';
    }
    if(statusEl) statusEl.innerHTML = statusBadge(d.status);
    FIELD_KEYS.forEach(k => setField(k, d[k]));
    setField('full_name', d.full_name || `${d.first_name} ${d.last_name}`.trim());
    setField('vat', d.id_number); // εδώ το "vat" το δένουμε με το id_number για εμφάνιση
  }

  // Είσοδος σε λειτουργία επεξεργασίας: μετατρέπει editable divs σε input
  function enterEdit(){
    state.editing = true;
    if(btnEdit) { btnEdit.classList.remove('ghost'); btnEdit.textContent = 'Αποθήκευση'; }

    // Προσθήκη κουμπιού "Άκυρο" δίπλα στο "Αποθήκευση"
    if(!$('#btnProfileCancel')){
      const cancel = document.createElement('button');
      cancel.id = 'btnProfileCancel';
      cancel.className = 'btn ghost';
      cancel.style.marginLeft = '8px';
      cancel.textContent = 'Άκυρο';
      btnEdit?.parentNode?.insertBefore(cancel, btnEdit.nextSibling);
      cancel.addEventListener('click', exitEdit);
    }

    // Όλα τα data-editable πεδία γίνονται input για inline επεξεργασία
    $$('[data-field][data-editable="true"]').forEach(el=>{
      if(el.querySelector('input')) return;         // αν έχει ήδη input, άστο
      const value = (el.textContent||'').trim();
      const input = document.createElement('input');
      input.className = 'input';
      input.value = value==='N/A' ? '' : value;     // άδειο αντί για N/A
      input.dataset.key = el.dataset.field;
      el.innerHTML = '';
      el.appendChild(input);
    });

    // Εμφάνιση φόρμας αλλαγής κωδικού στη λειτουργία επεξεργασίας
    pwdForm?.classList.remove('hidden');
  }

  // Έξοδος από λειτουργία επεξεργασίας: επιστροφή σε απλή εμφάνιση
  function exitEdit(){
    state.editing = false;
    if(btnEdit) btnEdit.textContent = 'Επεξεργασία';
    $('#btnProfileCancel')?.remove();

    // Επιστροφή των input σε απλό κείμενο (ή 'N/A' αν κενό)
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const inp = el.querySelector('input');
      if(!inp) return;
      const v = inp.value.trim();
      el.textContent = v || 'N/A';
      el.dataset.original = el.textContent;
    });

    // Απόκρυψη φόρμας αλλαγής κωδικού
    pwdForm?.classList.add('hidden');
  }

  // Συλλογή διαφορών (μόνο πεδία που άλλαξαν) για PATCH στο backend
  function collectPatch(){
    const patch = {};
    $$('[data-field][data-editable="true"]').forEach(el=>{
      const key = el.dataset.field;
      const val = el.querySelector('input')?.value ?? '';
      const original = el.dataset.original ?? '';
      if((val||'') !== (original==='N/A'?'':original)) {
        // Χαρτογράφηση id_number -> id_card (όνομα πεδίου που αναμένει ο server)
        patch[key === 'id_number' ? 'id_card' : key] = val;
      }
    });
    return patch;
  }

  // Αποθήκευση αλλαγών προφίλ (PATCH) + ανανέωση UI
  async function save(){
    const patch = collectPatch();
    if(Object.keys(patch).length===0){ exitEdit(); return; }

    // Βασικός έλεγχος email αν υπάρχει στο patch
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

  // Απλό toast helper (fallback σε alert αν δεν υπάρχει .toast)
  function toast(msg){
    let t = $('.toast'); if(!t){ alert(msg); return; }
    t.textContent = msg; t.classList.remove('hidden'); t.style.opacity='1';
    setTimeout(()=>{ t.style.opacity='0'; }, 2200);
  }

  // Υποβολή φόρμας αλλαγής κωδικού
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

  // Toggle: Επεξεργασία ↔ Αποθήκευση
  btnEdit?.addEventListener('click', ()=> state.editing ? save() : enterEdit());

  // Εκκίνηση: φόρτωσε το προφίλ όταν είναι έτοιμο το DOM
  document.addEventListener('DOMContentLoaded', loadProfile);
})();
