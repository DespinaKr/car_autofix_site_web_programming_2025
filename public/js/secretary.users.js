// /js/secretary.users.js
(function () {
  'use strict';
  // ----------------------------- Βοηθητικά & Σταθερές αναφορές DOM -----------------------------
  const $  = (s, r=document) => r.querySelector(s); // σύντομο querySelector

  // Βασικά στοιχεία του πίνακα/σελίδας
  const tbl      = $('#usersTable');   // κοντέινερ "πίνακα" χρηστών (grid-like)
  const pageInfo = $('#pageInfo');     // ένδειξη τρέχουσας σελίδας
  const totalInfo= $('#totalInfo');    // ένδειξη συνολικού πλήθους
  const btnPrev  = $('#btnPrev');      // προηγούμενη σελίδα
  const btnNext  = $('#btnNext');      // επόμενη σελίδα
  const inpSearch= $('#searchInput');  // πεδίο αναζήτησης
  const selRole  = $('#roleSelect');   // φίλτρο ρόλου

  // Αναφορές modal επεξεργασίας
  const modal = $('#editModal');
  const editForm = $('#editForm');
  const editTitle = $('#editTitle');
  const editClose = $('#editClose');
  const editCancel = $('#editCancel');
  const boxCustomer = $('#editCustomer'); // extra πεδία για πελάτη
  const boxMechanic = $('#editMechanic'); // extra πεδία για μηχανικό

  // ----------------------------- State -----------------------------
  const state = {
    meId:null, meRole:null,           // στοιχεία συνδεδεμένου χρήστη
    query:'', role:'', page:1, size:10, pages:1, total:0, items:[], editingId:null
  };

  // ----------------------------- Βοηθητικά labels/UI snippets -----------------------------
  const roleLabel   = (r) => r==='secretary' ? 'Γραμματέας' : r==='mechanic' ? 'Μηχανικός' : r==='customer' ? 'Πελάτης' : r || '—';
  const statusBadge = (on) => `<span class="badge ${on? 'green':'orange'}">${on? 'Ενεργός':'Ανενεργός'}</span>`;
  const initials    = (f,l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase();

  // Εικονίδια ενεργειών (inline SVG)
  const iToggle = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2c-4.5 0-8 2.25-8 5v1h16v-1c0-2.75-3.5-5-8-5Z"/></svg>`;
  const iEdit   = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11a1.004 1.004 0 0 0 0-1.42l-2.54-2.54a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 2.04-2.04Z"/></svg>`;
  const iTrash  = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6v2h5v2H4V5h5V3Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM6 8h12λ-1 13H7L6 8Z"/></svg>`;

  // ----------------------------- Κανόνες δικαιωμάτων ενεργειών -----------------------------
  function canEditRow(u){
    // Προεπιλογή: η σελίδα είναι για Γραμματέα. Αν ποτέ εμφανιστεί αλλιώς, επιτρέπεται self-edit.
    if (state.meRole === 'secretary') return true;
    return state.meId === u.id; // μόνο ο εαυτός του
  }
  function canActivate(u){ return state.meRole === 'secretary'; } // ενεργοποίηση/απενεργοποίηση μόνο από γραμματέα
  function canDelete(u){
    if (state.meRole === 'secretary') return true;
    return state.meId === u.id; // διαγραφή μόνο εαυτός (fallback λογική)
  }

  // ----------------------------- Απόδοση πίνακα χρηστών -----------------------------
  function render(){
    // Καθάρισε παλιές σειρές (κρατάει το .users-head)
    tbl.querySelectorAll('.users-row:not(.users-head)').forEach(n => n.remove());

    const items = state.items;
    if (!items.length){
      // Empty state όταν δεν υπάρχουν χρήστες
      const empty = document.createElement('div');
      empty.className = 'list-empty';
      empty.textContent = 'Δεν βρέθηκαν χρήστες.';
      tbl.appendChild(empty);
      pageInfo.textContent = `Σελίδα ${state.page} / ${state.pages}`;
      btnPrev.disabled = state.page<=1; btnNext.disabled = state.page>=state.pages;
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(u=>{
      const row = document.createElement('div');
      row.className = 'users-row';
      row.dataset.id = u.id;
      const full = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

      // Στήλη χρήστη (avatar + όνομα/email)
      const userCell = `
        <div class="user-main">
          <div class="av">${initials(u.first_name,u.last_name) || 'U'}</div>
          <div class="txt">
            <div class="name">${full}</div>
            <div class="email">${u.email || ''}</div>
          </div>
        </div>`;

      // Ρόλος / Κατάσταση / Λεπτομέρειες
      const roleCell  = `<span class="badge blue">${roleLabel(u.role)}</span>`;
      const statCell  = statusBadge(Number(u.is_active)===1);
      const detCell   =
        `<div class="muted">
           ${u.id_card ? `ID: ${u.id_card}` : ''}${u.afm ? `<br>Tax: ${u.afm}` : ''}${u.specialty ? `<br>Specialty: ${u.specialty}` : ''}
         </div>`;

      // Ενέργειες γραμμής (ανάλογα με δικαιώματα)
      let acts = '';
      if (canActivate(u))
        acts += `<button class="icon act-toggle" title="${Number(u.is_active)===1 ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}">${iToggle}</button>`;
      if (canEditRow(u))
        acts += `<button class="icon primary act-edit" title="Επεξεργασία">${iEdit}</button>`;
      if (canDelete(u))
        acts += `<button class="icon danger act-delete" title="Διαγραφή">${iTrash}</button>`;

      // Συναρμολόγηση σειράς
      row.innerHTML = `
        <div class="users-cell">${userCell}</div>
        <div class="users-cell">${roleCell}</div>
        <div class="users-cell">${statCell}</div>
        <div class="users-cell">${detCell}</div>
        <div class="users-cell"><div class="actions" data-id="${u.id}">${acts || ''}</div></div>
      `;
      frag.appendChild(row);
    });
    tbl.appendChild(frag);

    // Ενημέρωση pager controls
    pageInfo.textContent = `Σελίδα ${state.page} / ${state.pages}`;
    btnPrev.disabled = state.page<=1; btnNext.disabled = state.page>=state.pages;
  }

  // ----------------------------- Φόρτωση χρηστών από backend -----------------------------
  async function load(){
    // backend pagination (query/page/size). Το filter ρόλου εφαρμόζεται client-side αν χρειάζεται
    const url = `/api/users?query=${encodeURIComponent(state.query)}&page=${state.page}&size=${state.size}`;
    const res = await api(url); // αναμένεται { items, page, pages, total }
    let items = res.items || [];
    if (state.role) items = items.filter(x => x.role === state.role); // περαιτέρω client-side φιλτράρισμα
    state.pages = Math.max(1, res.pages || 1);
    state.total = res.total ?? items.length;
    state.items = items;
    render();
  }

  // ----------------------------- Έλεγχος πρόσβασης (guard) -----------------------------
  async function guard(){
    const me = await api('/api/users/me'); // φέρνουμε τον τρέχοντα χρήστη
    state.meId = me.id; state.meRole = me.role;
    if (me.role !== 'secretary') {
      // Αν δεν είναι γραμματέας, κάνε ήπια ανακατεύθυνση στο προφίλ
      location.replace('/dashboard/profile.html');
      return false;
    }
    return true;
  }

  // ----------------------------- Ενέργειες πίνακα (delegate σε #usersTable) -----------------------------
  tbl.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button.icon'); // εντοπίζει οποιοδήποτε από τα τρία κουμπιά
    if (!btn) return;
    const id = Number(btn.closest('.actions')?.dataset.id);
    const user = state.items.find(x => x.id === id);
    if (!user) return;

    // Ενεργοποίηση/Απενεργοποίηση
    if (btn.classList.contains('act-toggle')) {
      const toActive = !(Number(user.is_active)===1);
      try{
        await api(`/api/users/${id}/activate`, { method:'PATCH', body:{ active: toActive } });
        user.is_active = toActive ? 1 : 0; render(); // άμεσο UI update
      }catch(err){ alert(err?.error || 'Αποτυχία ενεργοποίησης/απενεργοποίησης.'); }
      return;
    }

    // Διαγραφή
    if (btn.classList.contains('act-delete')) {
      if (!confirm(`Διαγραφή χρήστη "${user.username}" ;`)) return;
      try{
        await api(`/api/users/${id}`, { method:'DELETE' });
        state.items = state.items.filter(x => x.id !== id);
        state.total = Math.max(0, state.total - 1);
        render();
      }catch(err){ alert(err?.error || 'Αποτυχία διαγραφής.'); }
      return;
    }

    // Επεξεργασία (άνοιγμα modal)
    if (btn.classList.contains('act-edit')) openEdit(user);
  });

  // ----------------------------- Άνοιγμα/Κλείσιμο modal επεξεργασίας -----------------------------
  function openEdit(u){
    state.editingId = u.id;
    editTitle.textContent = `Επεξεργασία: ${u.username}`;
    // Γέμισμα βασικών πεδίων
    editForm.first_name.value = u.first_name || '';
    editForm.last_name.value  = u.last_name  || '';
    editForm.email.value      = u.email      || '';
    editForm.username.value   = u.username   || '';
    editForm.id_card.value    = u.id_card    || '';

    // Εμφάνιση extra πεδίων αναλόγως ρόλου
    const isCust = u.role === 'customer';
    const isMech = u.role === 'mechanic';
    boxCustomer.classList.toggle('hidden', !isCust);
    boxMechanic .classList.toggle('hidden', !isMech);
    if (isCust){
      editForm.afm.value     = u.afm || '';
      editForm.address.value = u.address || '';
    }
    if (isMech){
      editForm.specialty.value = u.specialty || '';
    }

    // Εμφάνιση modal
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  }
  function closeEdit(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); state.editingId=null; }
  editClose?.addEventListener('click', closeEdit);
  editCancel?.addEventListener('click', closeEdit);
  modal?.addEventListener('click', e=>{ if(e.target===modal) closeEdit(); }); // click έξω από κάρτα → κλείσιμο

  // Υποβολή φόρμας edit: αποστολή PATCH και ανανέωση γραμμής
  editForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const id = state.editingId; if(!id) return;
    const payload = {
      first_name: editForm.first_name.value.trim(),
      last_name : editForm.last_name.value.trim(),
      email     : editForm.email.value.trim(),
      username  : editForm.username.value.trim(),
      id_card   : editForm.id_card.value.trim() || null
    };
    const u = state.items.find(x => x.id === id);
    if (u?.role === 'customer') {
      payload.afm     = editForm.afm.value.trim() || null;
      payload.address = editForm.address.value.trim() || null;
    }
    if (u?.role === 'mechanic') {
      payload.specialty = editForm.specialty.value.trim() || null;
    }

    try{
      const updated = await api(`/api/users/${id}`, { method:'PATCH', body: payload });
      const idx = state.items.findIndex(x => x.id === id);
      if (idx >= 0) state.items[idx] = { ...state.items[idx], ...updated }; // ενημέρωση cache
      render(); closeEdit();
    }catch(err){ alert(err?.error || 'Αποτυχία αποθήκευσης.'); }
  });

  // ----------------------------- Φίλτρα & Σελιδοποίηση -----------------------------
  let t=null; // debounce timer για αναζήτηση
  inpSearch?.addEventListener('input', e=>{
    clearTimeout(t);
    t = setTimeout(()=>{ state.query = e.target.value.trim(); state.page = 1; load().catch(console.error); }, 250);
  });
  selRole?.addEventListener('change', e=>{
    state.role = e.target.value || ''; state.page = 1; load().catch(console.error);
  });
  btnPrev?.addEventListener('click', ()=>{ if(state.page>1){ state.page--; load().catch(console.error); }});
  btnNext?.addEventListener('click', ()=>{ if(state.page<state.pages){ state.page++; load().catch(console.error); }});

  // ----------------------------- Εκκίνηση -----------------------------
  document.addEventListener('DOMContentLoaded', async ()=>{
    // Έλεγχος πρόσβασης: μόνο γραμματέας
    const ok = await guard().catch(()=>false);
    if (!ok) return;
    await load().catch(console.error); // αρχική φόρτωση δεδομένων
  });
})();
