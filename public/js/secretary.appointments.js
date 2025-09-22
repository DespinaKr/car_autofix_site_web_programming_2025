// public/js/secretary.appointments.js
(function () {
  'use strict';

  // ---------- DOM refs ----------
  const $ = (s, r = document) => r.querySelector(s);
  const grid = $('#apptGrid');
  const q = $('#q'), statusSel = $('#statusFilter'), dateSel = $('#dateFilter');
  const btnPrev = $('#btnPrev'), btnNext = $('#btnNext'), pageInfo = $('#pageInfo');
  const btnAdd = $('#btnAdd');

  // Modal
  const modal = $('#apptModal'), modalTitle = $('#modalTitle'), modalClose = $('#modalClose');
  const form = $('#apptForm');
  const customerRef = $('#customer_ref'), vehicleSel = $('#vehicle_id');
  const dt = $('#dt'), reason = $('#reason'), problem = $('#problem');
  const statusInput = $('#status'), work = $('#work'), cost = $('#cost');
  const btnCancel = $('#btnCancel');

  // ---------- State ----------
  const state = {
    page: 1,
    pages: 1,
    size: 6,
    editingId: null,
  };

  // ---------- Helpers ----------
  function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2500); }
  const pad = n => String(n).padStart(2,'0');

  function todayYMD(){
    const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function toLocalDT(value){
    // Accept ISO or "YYYY-MM-DD HH:mm"
    if(!value) return '';
    const d = new Date(value);
    if(isNaN(+d)) return '';
    const yyyy = d.getFullYear(), mm = pad(d.getMonth()+1), dd = pad(d.getDate());
    const hh = pad(d.getHours()), mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function withinHours(iso){
    const d = new Date(iso);
    if(isNaN(+d)) return false;
    const h = d.getHours();
    return h >= 8 && h <= 16; // inclusive 16:00 start accepted
  }

  const S = {
    CREATED: {txt:'Δημιουργημένο', cls:'pill pill--created'},
    IN_PROGRESS: {txt:'Σε εξέλιξη', cls:'pill pill--progress'},
    COMPLETED: {txt:'Περατωμένο', cls:'pill pill--done'},
    CANCELED: {txt:'Ακυρωμένο', cls:'pill pill--cancel'},
  };

  function pick(o, list){ for(const k of list){ if(o && o[k] != null) return o[k]; } return null; }

  function paint(items = [], page = 1, pages = 1){
    grid.innerHTML = '';
    if(!Array.isArray(items) || items.length === 0){
      grid.innerHTML = `<div class="empty">Δεν βρέθηκαν ραντεβού.</div>`;
      pageInfo.textContent = `Σελίδα ${page} / ${pages}`;
      return;
    }
    const frag = document.createDocumentFragment();

    items.forEach(ap => {
      // tolerant mapping
      const id = ap.id ?? ap.appt_id ?? ap.code ?? '';
      const code = ap.code ?? `APT${String(id).padStart(3,'0')}`;
      const datetime = pick(ap, ['datetime','date','startsAt','start_time','appointment_time']);
      const local = datetime ? new Date(datetime) : null;
      const dtStr = local ? `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())} at ${pad(local.getHours())}:${pad(local.getMinutes())}` : '—';

      const status = (ap.status || 'CREATED').toUpperCase();
      const st = S[status] || S.CREATED;

      const reasonTxt = (ap.reason || ap.type || 'service') === 'repair' ? 'Επιδιόρθωση' : 'Σέρβις';
      const problem = ap.problem || ap.issue || '';

      const customer = ap.customer_name || ap.customer || '—';
      const mechanic = ap.mechanic_name || ap.mechanic || '—';
      const vehicle = ap.vehicle_model || ap.vehicle || ap.car || '—';

      const work = ap.work || '';
      const cost = Number(ap.cost || 0);

      const card = document.createElement('article');
      card.className = 'card appt';
      card.innerHTML = `
        <div class="appt__head">
          <div class="av av--cal"></div>
          <div class="code">${code}</div>
          <div class="tools">
            <button class="ico-btn edit" title="Επεξεργασία" data-id="${id}">✎</button>
            <button class="ico-btn del" title="Ακύρωση" data-id="${id}">🗑</button>
          </div>
        </div>

        <div class="meta-row">
          <div class="${st.cls}">${st.txt}</div>
          <div class="dt">${dtStr}</div>
        </div>

        <div class="row"><span>Reason:</span> <span class="pill pill--type">${reasonTxt}</span></div>
        ${problem ? `<div class="row"><span>Problem:</span> <span>${problem}</span></div>` : ''}

        <div class="kv"><span>Customer:</span> <b>${customer}</b></div>
        <div class="kv"><span>Mechanic:</span> <b>${mechanic}</b></div>
        <div class="kv"><span>Vehicle:</span> <b>${vehicle}</b></div>

        ${work ? `<div class="kv"><span>Work:</span> <b>${work}</b></div>` : ''}
        <div class="kv"><span>Cost:</span> <b>€${cost.toFixed(0)}</b></div>
      `;
      frag.appendChild(card);
    });

    grid.appendChild(frag);
    pageInfo.textContent = `Σελίδα ${page} / ${pages}`;

    // events
    grid.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
    grid.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => cancelAppt(b.dataset.id)));
  }

  async function load(page = 1){
    try{
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('size', state.size);

      const query = (q.value || '').trim();
      const status = (statusSel.value || '').trim();
      const date = (dateSel.value || '').trim();

      if(query) params.set('query', query);
      if(status) params.set('status', status);
      // αν δεν δοθεί τίποτα, βάλε σημερινή ημερομηνία (ζητείται στην εκφώνηση)
      params.set('date', date || todayYMD());

      const res = await api(`/api/appointments?${params.toString()}`);
      const items = res.items ?? res.data ?? res.results ?? [];
      state.page = res.page ?? page;
      state.pages = res.pages ?? 1;
      paint(items, state.page, state.pages);
    }catch(err){
      console.error('appointments load error:', err);
      paint([], 1, 1);
    }
  }

  // ---------- Modal helpers ----------
  function openModal(){
    modal.setAttribute('aria-hidden','false');
    modal.classList.add('show');
  }
  function closeModal(){
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    state.editingId = null;
    form.reset();
    vehicleSel.innerHTML = `<option value="">— επιλέξτε πελάτη πρώτα —</option>`;
  }

  async function fillVehiclesForCustomer(val){
    // val: can be numeric id or username
    if(!val) { vehicleSel.innerHTML = `<option value="">— επιλέξτε πελάτη πρώτα —</option>`; return; }
    let ownerId = Number(val);
    if(!ownerId){
      // try resolve by username
      try{
        const r = await api(`/api/users?query=${encodeURIComponent(val)}&role=customer`);
        const first = (r.items||[])[0];
        ownerId = first?.id ? Number(first.id) : 0;
      }catch{ /* ignore */ }
    }
    if(!ownerId){
      vehicleSel.innerHTML = `<option value="">— δεν βρέθηκε πελάτης —</option>`;
      return;
    }
    try{
      const vs = await api(`/api/vehicles?owner_id=${ownerId}&size=100`);
      const arr = vs.items ?? vs.data ?? [];
      vehicleSel.innerHTML = arr.length
        ? arr.map(v => `<option value="${v.id}">${v.brand || v.make || ''} ${v.model || ''} (${v.serial_no || v.vin || v.serial})</option>`).join('')
        : `<option value="">— δεν έχει οχήματα —</option>`;
    }catch{
      vehicleSel.innerHTML = `<option value="">— σφάλμα φόρτωσης —</option>`;
    }
  }

  function openAdd(){
    state.editingId = null;
    modalTitle.textContent = 'Νέο Ραντεβού';
    statusInput.value = 'CREATED';
    reason.value = 'service';
    work.value = '';
    cost.value = '';
    dt.value = '';
    openModal();
  }

  async function openEdit(id){
    try{
      const ap = await api(`/api/appointments/${id}`);
      state.editingId = id;
      modalTitle.textContent = `Επεξεργασία: ${ap.code || 'APT'+String(id).padStart(3,'0')}`;

      // map fields
      customerRef.value = ap.customer_username || ap.customer_id || ap.customer || '';
      await fillVehiclesForCustomer(customerRef.value);
      vehicleSel.value = ap.vehicle_id || '';

      dt.value = toLocalDT(pick(ap,['datetime','date','startsAt','start_time','appointment_time']));
      reason.value = (ap.reason || ap.type || 'service') === 'repair' ? 'repair' : 'service';
      problem.value = ap.problem || ap.issue || '';
      statusInput.value = (ap.status || 'CREATED').toUpperCase();
      work.value = ap.work || '';
      cost.value = ap.cost || '';

      openModal();
    }catch(err){
      console.error(err);
      toast(err.error || 'Σφάλμα φόρτωσης ραντεβού.');
    }
  }

  async function cancelAppt(id){
    if(!confirm('Να ακυρωθεί το ραντεβού;')) return;
    try{
      // προτιμάμε dedicated action, αλλιώς generic PATCH
      try{
        await api(`/api/appointments/${id}/cancel`, { method: 'PATCH' });
      }catch{
        await api(`/api/appointments/${id}`, { method: 'PATCH', body: { action: 'cancel' }});
      }
      toast('Ακυρώθηκε.');
      await load(state.page);
    }catch(err){
      console.error(err);
      toast(err.error || 'Δεν ήταν δυνατή η ακύρωση.');
    }
  }

  function validate(){
    const when = dt.value;
    if(!when) throw new Error('Συμπλήρωσε ημερομηνία/ώρα.');
    if(!withinHours(when)) throw new Error('Η ώρα πρέπει να είναι 08:00–16:00.');

    if(!vehicleSel.value) throw new Error('Επίλεξε όχημα.');
    if(reason.value === 'repair' && !problem.value.trim()) throw new Error('Πρόβλημα απαιτείται για επιδιόρθωση.');
  }

  async function save(e){
    e.preventDefault();
    try{
      validate();

      const body = {
        customer_ref: customerRef.value.trim() || null,
        vehicle_id: Number(vehicleSel.value),
        datetime: new Date(dt.value).toISOString(),
        reason: reason.value, // 'service' | 'repair'
        problem: problem.value.trim() || null,
        status: statusInput.value,
        work: work.value.trim() || null,
        cost: cost.value ? Number(cost.value) : 0,
        auto_assign_mechanic: true
      };

      if(state.editingId){
        // rules από εκφώνηση: αλλαγή ημερομηνίας/ώρας μόνο όταν CREATED,
        // status αλλάζει μόνο από γραμματέα (εμείς είμαστε γραμματέας εδώ)
        await api(`/api/appointments/${state.editingId}`, { method: 'PATCH', body });
        toast('Ενημερώθηκε.');
      }else{
        await api('/api/appointments', { method: 'POST', body });
        toast('Δημιουργήθηκε.');
      }
      closeModal();
      await load(state.page);
    }catch(err){
      console.error(err);
      toast(err.message || err.error || 'Αποτυχία αποθήκευσης.');
    }
  }

  // ---------- Events ----------
  btnAdd.addEventListener('click', openAdd);
  modalClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  form.addEventListener('submit', save);

  q.addEventListener('input', () => load(1));
  statusSel.addEventListener('change', () => load(1));
  dateSel.addEventListener('change', () => load(1));

  customerRef.addEventListener('change', () => fillVehiclesForCustomer(customerRef.value));

  btnPrev.addEventListener('click', () => { if(state.page>1) load(state.page-1); });
  btnNext.addEventListener('click', () => { if(state.page<state.pages) load(state.page+1); });

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', async () => {
    dateSel.value = todayYMD();     // default: σήμερα (σύμφωνα με εκφώνηση)
    await load(1);
  });
})();
