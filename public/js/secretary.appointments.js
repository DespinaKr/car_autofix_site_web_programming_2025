/* Secretary - Appointments (wired to your backend) */
(function () {
  'use strict';

  // ---------- refs ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const grid = $('#apptGrid');
  const q = $('#q');
  const statusFilter = $('#statusFilter');
  const dateFilter = $('#dateFilter');
  const btnAdd = $('#btnAdd');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');
  const pageInfo = $('#pageInfo');
  const totalInfo = $('#totalInfo');

  const modal = $('#apptModal');
  const modalTitle = $('#modalTitle');
  const modalClose = $('#modalClose');
  const form = $('#apptForm');
  const F = (id) => form.querySelector(id);

  const group = (name) => form.querySelector(`[data-group="${name}"]`);

  function toggleProblem() {
    const isRepair = F('#reason') && F('#reason').value === 'repair';
    if (group('problem')) {
      group('problem').classList.toggle('hidden', !isRepair);
    }
    if (F('#problem')) {
      F('#problem').required = isRepair;
      if (!isRepair) F('#problem').value = '';
    }
  }


  let page = 1, pages = 1, size = 6;
  const state = { query: '', status: '', date: '' };
  let lastItems = [];
  const itemsById = new Map();

  function getId(a) { return a?.id ?? a?.appointment_id ?? a?.appId ?? a?.ID; }

  const GSTATUS = {
    CREATED: 'Δημιουργημένο',
    IN_PROGRESS: 'Σε εξέλιξη',
    COMPLETED: 'Περατωμένο',
    CANCELED: 'Ακυρωμένο'
  };
  const GREASON = { service: 'Σέρβις', repair: 'Επιδιόρθωση' };

  // ---------- helpers ----------
  function debounce(fn, t = 200) { let to; return (...a) => { clearTimeout(to); to = setTimeout(() => fn(...a), t); }; }
 
  function badgeStatus(s) { const x = document.createElement('span'); x.className = `badge badge--status--${s}`; x.textContent = GSTATUS[s] || s || '—'; return x; }
  function badgeReason(r) { const x = document.createElement('span'); x.className = `badge badge--reason--${r}`; x.textContent = GREASON[r] || r || '—'; return x; }
  // ---------------- TZ-safe helpers ----------------
function pad2(n){ return String(n).padStart(2,'0'); }

// παίρνω "2024-01-20T14:00" ή "2024-01-20 14:00:00" και επιστρέφω "20/1/2024 στις 14:00"
function fmt(dt){
  if (!dt) return '—';
  const s = String(dt).replace(' ', 'T');
  const [dPart, tPartRaw=''] = s.split('T');
  const [y,m,d] = dPart.split('-').map(Number);
  const [hh='00',mm='00'] = tPartRaw.split(':');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y} στις ${hh}:${mm}`;
}

// "YYYY-MM-DD" + "HH:mm[:ss]" -> "YYYY-MM-DDTHH:mm"
function normalizeStart(a){
  const d = (a?.appt_date || '').slice(0,10);
  let t = (a?.appt_time || '').slice(0,5);
  if (!d || !t) return a?.startsAt || '';
  return `${d}T${t}`;
}

// από input value του datetime-local -> {date, time}
function splitDT(v){
  if (!v) return { date:'', time:'' };
  const s = String(v).replace(' ', 'T');
  const [date, timeRaw=''] = s.split('T');
  return { date, time: timeRaw.slice(0,5) };
}


  function isoDatePart(v) {
    if (!v) return '';
    if (typeof v === 'string') {
      const m = v.match(/^\d{4}-\d{2}-\d{2}/);
      if (m) return m[0];
      const d = new Date(v);
      return isNaN(d) ? '' : d.toISOString().slice(0, 10);
    }
    const d = new Date(v);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  }
 
  function vehicleText(a) {
    const byLabel = a?.vehicle_label?.trim();
    if (byLabel) return byLabel;
    const make = (a?.vehicle?.brand ?? a?.vehicle?.make ?? a?.vehicle_make ?? '').trim();
    const model = (a?.vehicle?.model ?? a?.vehicle_model ?? '').trim();
    const mm = [make, model].filter(Boolean).join(' ');
    if (mm) return mm;
    const serial = a?.vehicle?.serial ?? a?.vehicle_serial ?? '';
    return serial || '—';
  }
  function vehicleTitleFrom(a) {
    const byLabel = a?.vehicle_label && String(a.vehicle_label).trim();
    if (byLabel) return byLabel;
    const vmodel = a?.vehicle_model && String(a.vehicle_model).trim();
    if (vmodel) return vmodel;
    const brand = (a?.vehicle?.brand ?? a?.brand ?? '').trim();
    const model = (a?.vehicle?.model ?? a?.model ?? '').trim();
    const mm = [brand, model].filter(Boolean).join(' ');
    if (mm) return mm;
    return a?.vehicle?.serial || a?.vehicle_serial || '—';
  }
  // --- dynamic customer → vehicles -----------------------------

  // προσπαθεί να βρει userId από "7" ή "john"
  async function resolveCustomerRef(ref) {
    if (!ref) return null;
    const raw = String(ref).trim();
    // αν είναι καθαρός αριθμός, γύρνα τον
    if (/^\d+$/.test(raw)) return Number(raw);

    // αλλιώς ψάξε χρήστη με username ή query
    // ΔΟΚΙΜΑΖΕΙ πρώτα ?username=, μετά ?query= (ανάλογα τι υποστηρίζει ο users router σου)
    try {
      let res = await api(`/api/users?username=${encodeURIComponent(raw)}`);
      if (Array.isArray(res?.items) && res.items.length) return res.items[0].id;
    } catch { }
    try {
      let res = await api(`/api/users?query=${encodeURIComponent(raw)}`);
      if (Array.isArray(res?.items) && res.items.length) return res.items[0].id;
    } catch { }
    return null;
  }

  // φέρνει οχήματα για πελάτη και γεμίζει το <select id="vehicle_id">
  async function populateVehicles(customerId, selectedId) {
    const sel = F('#vehicle_id');
    if (!sel) return;

    if (!customerId) {
      sel.innerHTML = `<option value="">— επιλέξτε πελάτη πρώτα —</option>`;
      return;
    }

    // ο vehicles router σου πιθανόν δέχεται ένα από αυτά τα params
    const tryUrls = [
      `/api/vehicles?customer=${customerId}`,
      `/api/vehicles?owner_id=${customerId}`,
      `/api/vehicles?owner=${customerId}`,
      `/api/vehicles?user_id=${customerId}`,
    ];

    let items = [];
    for (const u of tryUrls) {
      try {
        const r = await api(u);
        if (Array.isArray(r?.items)) { items = r.items; break; }
      } catch { /* δοκίμασε το επόμενο */ }
    }

    if (!items.length) {
      sel.innerHTML = `<option value="">— δεν βρέθηκαν οχήματα —</option>`;
      return;
    }

    // ωραία ετικέτα: brand + model ή ό,τι έχεις διαθέσιμο
    const options = items.map(v => {
      const brand = (v.brand ?? v.make ?? '').trim();
      const model = (v.model ?? '').trim();
      const label = [brand, model].filter(Boolean).join(' ') || (v.serial ?? v.plate ?? `#${v.id}`);
      return `<option value="${v.id}">${label}</option>`;
    }).join('');

    sel.innerHTML = `<option value="">— επιλέξτε όχημα —</option>${options}`;
    if (selectedId) sel.value = String(selectedId);
  }
  function setVehiclePlaceholder(text = '— επιλέξτε πελάτη πρώτα —', disabled = true) {
  const sel = F('#vehicle_id');
  if (!sel) return;
  sel.innerHTML = `<option value="">${text}</option>`;
  sel.disabled = !!disabled;
}

// Προσπάθησε να λύσεις ένα ref -> user id
async function resolveCustomerRef(ref) {
  const v = (ref || '').trim();
  if (!v) return null;

  // Αν είναι καθαρά νούμερο, το παίρνουμε ως id
  if (/^\d+$/.test(v)) return Number(v);

  // Αλλιώς δοκίμασε endpoint επίλυσης (προσαρμοσμένο στα δικά σου routes)
  try {
    // Αν έχεις /api/users/resolve?ref=...
    const r1 = await api(`/api/users/resolve?ref=${encodeURIComponent(v)}`);
    if (r1?.id) return Number(r1.id);
  } catch {}

  try {
    // fallback: αν έχεις /api/users?ref=...
    const r2 = await api(`/api/users?ref=${encodeURIComponent(v)}`);
    if (r2?.id) return Number(r2.id);
    if (Array.isArray(r2?.items) && r2.items[0]?.id) return Number(r2.items[0].id);
  } catch {}

  return null;
}

// Φέρε οχήματα για userId και γέμισε dropdown
async function populateVehicles(userId, selectedId = null) {
  const sel = F('#vehicle_id');
  if (!sel) return;

  if (!userId) {
    setVehiclePlaceholder('— επιλέξτε πελάτη πρώτα —', true);
    return;
  }

  sel.disabled = true;
  sel.innerHTML = `<option value="">Φόρτωση...</option>`;

  // Προσαρμόσε το param στο δικό σου API: owner_id ή customer_id
  let data;
  try {
    // παίζει συνήθως ένα από τα δύο:
    try {
      data = await api(`/api/vehicles?owner_id=${userId}`);
    } catch {
      data = await api(`/api/vehicles?customer_id=${userId}`);
    }
  } catch {
    setVehiclePlaceholder('— δεν βρέθηκαν οχήματα —', true);
    return;
  }

  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  if (!items.length) {
    setVehiclePlaceholder('— δεν βρέθηκαν οχήματα —', true);
    return;
  }

  sel.disabled = false;
  sel.innerHTML = items.map(v => {
    const label = [v.brand || v.make || '', v.model || ''].filter(Boolean).join(' ') || (v.serial || v.plate || `#${v.id}`);
    return `<option value="${v.id}" ${selectedId && Number(selectedId) === Number(v.id) ? 'selected' : ''}>${label}</option>`;
  }).join('');
}



  // ---------- LOAD ----------
  async function load() {
    const p = new URLSearchParams();
    if (state.query) p.set('query', state.query);
    if (state.status && state.status !== 'ALL') p.set('status', state.status);
    if (state.date) p.set('from', state.date), p.set('to', state.date);
    if (!state.query && !state.date && !(state.status && state.status !== 'ALL')) p.set('recent', '50');

    p.set('page', String(page));
    p.set('size', String(size));

    const res = await api('/api/appointments?' + p.toString());
    const items = res?.items || [];
    lastItems = items;
    itemsById.clear();
    for (const a of items) {
      const id = Number(getId(a));
      if (!Number.isNaN(id)) itemsById.set(id, a);
    }

    const total = res?.total ?? items.length;
    pages = Math.max(1, res?.pages ?? Math.ceil(total / Math.max(1, size)));

    render(items);
    if (pageInfo) pageInfo.textContent = `Σελίδα ${page} / ${pages}`;
    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page >= pages;
    if (totalInfo) totalInfo.textContent = `${items.length} / ${total} ραντεβού`;
  }

  // ---------- RENDER ----------
  function render(items) {
    grid.innerHTML = '';
    if (!items.length) {
      grid.innerHTML = `<div class="card appt"><div class="appt__title">Δεν βρέθηκαν ραντεβού.</div></div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(a => {
      const id = Number(getId(a));
      const code = a.appt_code || a.code || 'APT';
      const date = normalizeStart(a);
      const cust = a.customer_name || '—';
      const mech = a.mechanic_name || '—';
      const veh = vehicleText(a);
      const probOrWork = a.reason === 'repair' ? (a.problem_desc || '—') : (a.work || '—');

      const card = document.createElement('article');
      card.className = 'card appt';

      const head = document.createElement('div');
      head.className = 'appt__row appt__row--between';
      head.innerHTML = `
        <div class="appt__title">${code}</div>
        <div class="appt__actions" data-id="${id}">
          <button class="appt__btn js-edit" title="Επεξεργασία">
            <svg class="ico" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M5 19h14v2H5zM19.71 7.04a1.003 1.003 0 0 0 0-1.42l-1.34-1.34a1.003 1.003 0 0 0-1.42 0L9 11.83V15h3.17l7.54-7.96z"/></svg>
          </button>
          <button class="appt__btn js-cancel" title="Ακύρωση">
            <svg class="ico" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12v2H6zM8 10h8l-1 10H9zM9 4h6l1 2H8z"/></svg>
          </button>
        </div>`;
      card.appendChild(head);

      const meta = document.createElement('div');
      meta.className = 'appt__row';
      const when = document.createElement('div');
      when.className = 'appt__meta';
      when.textContent = fmt(date);
      meta.appendChild(when);
      meta.appendChild(badgeStatus(a.status));
      meta.appendChild(badgeReason(a.reason));
      card.appendChild(meta);

      const details = document.createElement('div');
      details.className = 'appt__grid';
      details.innerHTML = `
        <div><div class="appt__label">Πελάτης</div>  <div class="appt__value">${cust}</div></div>
        <div><div class="appt__label">Μηχανικός</div><div class="appt__value">${mech}</div></div>
        <div><div class="appt__label">Όχημα</div>   <div class="appt__value">${veh}</div></div>
        <div><div class="appt__label">${a.reason === 'repair' ? 'Πρόβλημα' : 'Εργασία'}</div><div class="appt__value">${probOrWork}</div></div>
        <div><div class="appt__label">Κόστος</div>   <div class="appt__value">${a.total_cost ? `€${a.total_cost}` : '—'}</div></div>
      `;
      card.appendChild(details);

      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  // ---------- events ----------
  q?.addEventListener('input', debounce(() => { state.query = q.value.trim(); page = 1; load(); }, 250));
  statusFilter?.addEventListener('change', () => { state.status = statusFilter.value || ''; page = 1; load(); });
  dateFilter?.addEventListener('change', () => { state.date = dateFilter.value || ''; page = 1; load(); });

  btnPrev?.addEventListener('click', () => { if (page > 1) { page--; load(); } });
  btnNext?.addEventListener('click', () => { if (page < pages) { page++; load(); } });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = Number(btn.closest('.appt__actions')?.dataset.id);
    if (btn.classList.contains('js-edit')) openEdit(id);
    if (btn.classList.contains('js-cancel')) cancelAppt(id);
  });

  // ---------- modal ----------
  function openModal() { modal.setAttribute('aria-hidden', 'false'); }
  function closeModal() { modal.setAttribute('aria-hidden', 'true'); form.reset(); form.dataset.id = ''; form.dataset.origTotal = ''; }

  $('#btnCancel')?.addEventListener('click', closeModal);
  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  btnAdd?.addEventListener('click', () => {
    modalTitle.textContent = 'Νέο Ραντεβού';
    form.dataset.id = '';
    form.dataset.customerId = '';

    // status = CREATED, κρυφό στο create
    if (F('#status')) F('#status').value = 'CREATED';
    group('status')?.classList.add('hidden');

    // κρύψε work/cost στο create
    group('work')?.classList.add('hidden');
    group('cost')?.classList.add('hidden');

    // καθάρισε customer & vehicles
    if (F('#customer_ref')) F('#customer_ref').value = '';
    if (F('#vehicle_id')) F('#vehicle_id').innerHTML = `<option value="">— επιλέξτε πελάτη πρώτα —</option>`;

    // προεπιλογή reason=service και sync «Πρόβλημα»
    if (F('#reason')) F('#reason').value = 'service';
    toggleProblem();

    openModal();
  });


  // ---------- open edit ----------
  async function openEdit(id) {
    let a = itemsById.get(Number(id)) || lastItems.find(x => getId(x) == id);
    if (!a) {
      try { a = await api(`/api/appointments/${id}`); }
      catch (err) { console.error(err); alert('Δεν βρέθηκαν δεδομένα ραντεβού.'); return; }
    }

    modalTitle.textContent = `Επεξεργασία: ${a.appt_code || 'APT'}`;
    form.dataset.id = Number(getId(a));

    const start = normalizeStart(a);
    const vehTitle = vehicleTitleFrom(a);

    // κρατάμε το αρχικό σύνολο για να υπολογίζουμε διαφορά
    const origTotal = a.total_cost != null ? Number(a.total_cost) : 0;
    form.dataset.origTotal = String(origTotal);

    // πεδία φόρμας
    F('#customer_ref') && (F('#customer_ref').value = a.customer_id ?? '');
    F('#vehicle_id') && (F('#vehicle_id').innerHTML = `<option value="${a.vehicle_id ?? ''}">${vehTitle}</option>`);
    F('#dt') && (F('#dt').value = start ? start.slice(0, 16) : '');
    F('#reason') && (F('#reason').value = a.reason || 'service');
    F('#problem') && (F('#problem').value = a.problem_desc || '');
    F('#status') && (F('#status').value = a.status || 'CREATED');

    // «Εργασία» κενό (για νέα εργασία), «Κόστος» δείχνει τρέχον σύνολο για ενημέρωση
    if (F('#work')) F('#work').value = '';
    if (F('#cost')) F('#cost').value = origTotal ? String(origTotal) : '';
    const currentCustomerId = a.customer_id ?? null;
    form.dataset.customerId = currentCustomerId ? String(currentCustomerId) : '';
    await populateVehicles(currentCustomerId, a.vehicle_id ?? null);

    // δείξε τα πεδία που είναι ορατά μόνο στο edit
    group('status')?.classList.remove('hidden');
    group('work')?.classList.remove('hidden');
    group('cost')?.classList.remove('hidden');

    // sync το "Πρόβλημα" και άνοιξε modal
    toggleProblem();
    openModal();

  }

  // ---------- submit (create/update) ----------
  // ---------- submit (create/update) ----------
form?.addEventListener('submit', async (ev) => {
  ev.preventDefault();

  // διάβασε date/time από το datetime-local
  const { date, time } = splitDT(F('#dt') ? F('#dt').value : '');

  // λύσε τον πελάτη από dataset (ή επί τόπου από το input αν δεν έχει γίνει change)
  let userIdResolved = Number(form.dataset.customerId || 0) || undefined;
  if (!userIdResolved) {
    const _ref = F('#customer_ref')?.value?.trim() || '';
    const maybe = await resolveCustomerRef(_ref);
    if (maybe) userIdResolved = Number(maybe);
  }

  // φτιάξε το βασικό body
  const patchBody = {
    customer_id: userIdResolved,
    vehicle_id: Number(F('#vehicle_id')?.value || 0) || undefined,
    appt_date: date || undefined,
    appt_time: time || undefined,
    reason: F('#reason')?.value || undefined,
    problem_desc: F('#problem')?.value ?? null,  // παραμένει null αν δεν έχεις repair
    status: F('#status')?.value || undefined,
  };
  // πέτα τα undefined keys
  Object.keys(patchBody).forEach(k => patchBody[k] === undefined && delete patchBody[k]);

  try {
    const id = Number(form.dataset.id || 0);

    // CREATE ή UPDATE
    if (id) {
      await api(`/api/appointments/${id}`, { method: 'PATCH', body: patchBody });
    } else {
      await api(`/api/appointments`, { method: 'POST', body: patchBody });
    }

    // ---- Εργασίες / Κόστος (ΜΟΝΟ στο edit) ----
    if (id) {
      const origTotal = Number(form.dataset.origTotal || 0);
      const workText  = (F('#work')?.value || '').trim();

      // δέχεσαι και κόμμα ως δεκαδικό
      const costStrRaw = (F('#cost')?.value || '').trim().replace(',', '.');
      const hasCost = costStrRaw !== '' && !isNaN(Number(costStrRaw));
      const newTotal = hasCost ? Number(costStrRaw) : null;

      const calls = [];

      // Αν έγραψες 'Εργασία', το κόστος θεωρείται κόστος αυτής της εργασίας
      if (workText) {
        const workCost = hasCost ? Number(costStrRaw) : 0;
        if (workCost !== 0) {
          calls.push(api(`/api/appointments/${id}/works`, {
            method: 'POST',
            body: { description: workText, materials: '', finished_at: null, cost: workCost }
          }));
        }
      } else if (hasCost && newTotal !== origTotal) {
        // Χωρίς νέα εργασία αλλά άλλαξε το συνολικό -> στείλε τη ΔΙΑΦΟΡΑ
        const diff = newTotal - origTotal;
        if (diff !== 0) {
          calls.push(api(`/api/appointments/${id}/works`, {
            method: 'POST',
            body: { description: 'Adjustment', materials: '', finished_at: null, cost: diff }
          }));
        }
      }

      if (calls.length) await Promise.all(calls);
    }

    closeModal();
    load();
    toast('Αποθηκεύτηκε.');
  } catch (err) {
    console.error(err);
    alert(err?.error || 'Αποτυχία αποθήκευσης.');
  }
});



  // ---------- cancel (αντί για hard delete) ----------
  async function cancelAppt(id) {
    if (!confirm('Ακύρωση ραντεβού;')) return;
    try {
      await api(`/api/appointments/${id}/cancel`, { method: 'POST' });
      load(); toast('Ακυρώθηκε.');
    } catch (err) {
      console.error(err);
      alert(err?.error || 'Αποτυχία ακύρωσης.');
    }
  }

  // ---------- init ----------
  document.addEventListener('DOMContentLoaded', load);
})();
