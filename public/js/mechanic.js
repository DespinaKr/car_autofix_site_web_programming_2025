// /js/mechanic.js
(function () {
  'use strict';

  // ---------- shorthands ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const grid = $('#apptGrid');
  const dateFilter = $('#dateFilter');
  const statusFilter = $('#statusFilter');
  const btnClear = $('#btnClear');

  // modal refs
  const m = $('#workModal');
  const workForm = $('#workForm');
  const workTitle = $('#workTitle');
  const workClose = $('#workClose');
  const btnWorkCancel = $('#btnWorkCancel');

  function openModal() { m?.setAttribute('aria-hidden', 'false'); }
  function closeModal() { m?.setAttribute('aria-hidden', 'true'); workForm?.reset(); workForm.dataset.id = ''; }

  const say = (msg) => (window.toast ? window.toast(msg) : alert(msg));

  // ---------- labels ----------
  const GSTATUS = {
    CREATED: 'Δημιουργημένο',
    IN_PROGRESS: 'Σε εξέλιξη',
    COMPLETED: 'Περατωμένο',
    CANCELED: 'Ακυρωμένο'
  };
  const STATUS_CLASS = { CREATED: 'blue', IN_PROGRESS: 'orange', COMPLETED: 'green', CANCELED: 'red' };
  const GREASON = { service: 'Σέρβις', repair: 'Επιδιόρθωση' };

  // ---------- tz-safe helpers ----------
  const pad2 = (n) => String(n).padStart(2, '0');

  function fmt(dt) {
    if (!dt) return '—';
    const s = String(dt).replace(' ', 'T');
    const [dPart, tPartRaw = ''] = s.split('T');
    const [y, m, d] = dPart.split('-').map(Number);
    const [hh = '00', mm = '00'] = tPartRaw.split(':');
    if (!y || !m || !d) return '—';
    return `${d}/${m}/${y} στις ${hh}:${mm}`;
  }

  // "YYYY-MM-DD" + "HH:mm[:ss]" -> "YYYY-MM-DDTHH:mm"
  function normalizeStart(a) {
    const d = (a?.appt_date || '').slice(0, 10);
    let t = (a?.appt_time || '').slice(0, 5);
    if (!d || !t) return a?.startsAt || '';
    return `${d}T${t}`;
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

  // ---------- state ----------
  const state = { me: null, items: [], date: '', status: '' };

  // ---------- auth + boot ----------
  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const auth = await api('/api/auth/me');
      const me = auth?.user || auth;
      if (!me || me.role !== 'mechanic') return location.href = '/login.html';
      state.me = me;

      // navbar
      const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username || 'Μηχανικός';
      $('#navUser') && ($('#navUser').textContent = fullName);

      // logout
      document.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-action="logout"]'); if (!b) return;
        await api('/api/auth/logout', { method: 'POST' }); location.href = '/login.html';
      });

      // filters
      dateFilter?.addEventListener('change', () => { state.date = dateFilter.value || ''; load(); });
      statusFilter?.addEventListener('change', () => { state.status = statusFilter.value || ''; load(); });
      btnClear?.addEventListener('click', () => {
        state.date = ''; state.status = '';
        if (dateFilter) dateFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        load();
      });

      // modal events
      workClose?.addEventListener('click', closeModal);
      btnWorkCancel?.addEventListener('click', closeModal);
      m?.addEventListener('click', (e) => { if (e.target === m) closeModal(); });

      workForm?.addEventListener('submit', onSaveWork);

      load();
    } catch (err) {
      console.error(err);
      location.href = '/login.html';
    }
  }

  // ---------- load appointments ----------
  async function load() {
    // προσπαθούμε να φέρουμε "μόνα μου"
    const p = new URLSearchParams();
    if (state.status) p.set('status', state.status);
    if (state.date) p.set('from', state.date), p.set('to', state.date);

    let res;
    try { res = await api('/api/appointments?mine=1&' + p.toString()); }
    catch {
      try { res = await api(`/api/appointments?mechanic_id=${state.me.id}&` + p.toString()); }
      catch { res = await api('/api/appointments?' + p.toString()); }
    }

    let items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    // fallback φίλτρο, αν ο server δεν φιλτράρει
    items = items.filter(a => Number(a.mechanic_id ?? a.mechanic?.id) === Number(state.me.id));

    state.items = items;
    render(items);
    renderVehiclesFromAppointments(items); // <-- ΠΡΟΣΘΗΚΗ

  }

  // ---------- render ----------
  function render(list) {
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="small">Δεν βρέθηκαν ραντεβού.</div>';
      return;
    }
    const frag = document.createDocumentFragment();

    list.forEach(a => {
      const id = Number(a.id || a.appointment_id || a.ID);
      const code = a.appt_code || a.code || `APT#${id}`;
      const st = a.status || 'CREATED';
      const when = fmt(normalizeStart(a));
      const veh = vehicleText(a);
      const cust = a.customer_name || a.customer_fullname || '—';
      const mech = a.mechanic_name || '—';
      const reason = GREASON[a.reason] || a.reason || '—';
      const total = a.total_cost == null ? '—' : `€${a.total_cost}`;

      const card = document.createElement('article');
      card.className = 'card appt';

      const head = document.createElement('div');
      head.className = 'appt__row appt__row--between';
      head.innerHTML = `
        <div class="appt__title">${code}</div>
        <div class="appt__meta">${when}</div>`;
      card.appendChild(head);

      const badges = document.createElement('div');
      badges.className = 'appt__row';
      badges.innerHTML = `
        <span class="badge badge--status--${st}">${GSTATUS[st] || st}</span>
        <span class="badge">${reason}</span>`;
      card.appendChild(badges);

      const body = document.createElement('div');
      body.className = 'appt__grid';
      body.innerHTML = `
        <div><div class="appt__label">Πελάτης</div><div class="appt__value">${cust}</div></div>
        <div><div class="appt__label">Μηχανικός</div><div class="appt__value">${mech}</div></div>
        <div><div class="appt__label">Όχημα</div><div class="appt__value">${veh}</div></div>
        <div><div class="appt__label">Σύνολο</div><div class="appt__value">${total}</div></div>`;
      card.appendChild(body);

      // φόρμα εργασίας ΜΟΝΟ όταν είναι ΣΕ ΕΞΕΛΙΞΗ
      if (st === 'IN_PROGRESS') {
        const workBox = document.createElement('div');
        workBox.className = 'field';
        workBox.style.marginTop = '8px';
        workBox.innerHTML = `
          <div class="small" style="margin-bottom:6px">Προσθήκη εργασίας</div>
          <div class="grid cols-3" style="gap:6px">
            <input class="input" placeholder="Περιγραφή" data-k="desc">
            <input class="input" placeholder="Υλικά (προαιρετικό)" data-k="materials">
            <input class="input" type="number" step="0.01" min="0" placeholder="Κόστος (€)" data-k="cost">
          </div>
          <div style="text-align:right;margin-top:6px">
            <button class="btn js-open-modal" data-id="${id}">Σε φόρμα…</button>
            <button class="btn ghost js-add" data-id="${id}" style="margin-left:6px">Προσθήκη</button>
          </div>`;
        card.appendChild(workBox);
      }

      frag.appendChild(card);
    });

    grid.appendChild(frag);
  }

  // inline γρήγορη προσθήκη
  grid.addEventListener('click', async (e) => {
    const add = e.target.closest('.js-add');
    if (add) {
      const id = Number(add.dataset.id);
      const card = add.closest('.card');
      const desc = card.querySelector('[data-k="desc"]')?.value?.trim();
      const materials = card.querySelector('[data-k="materials"]')?.value?.trim() || '';
      const costStr = card.querySelector('[data-k="cost"]')?.value?.trim().replace(',', '.');

      if (!desc || !costStr || isNaN(Number(costStr))) { say('Συμπλήρωσε περιγραφή και έγκυρο κόστος.'); return; }
      try {
        await api(`/api/appointments/${id}/works`, {
          method: 'POST',
          body: { description: desc, materials, finished_at: null, cost: Number(costStr) }
        });
        say('Η εργασία καταχωρήθηκε.');
        load();
      } catch (err) { console.error(err); say(err?.error || 'Αποτυχία προσθήκης εργασίας.'); }
    }

    const open = e.target.closest('.js-open-modal');
    if (open) {
      workForm.dataset.id = String(open.dataset.id);
      workTitle.textContent = `Νέα εργασία · ${open.dataset.id}`;
      openModal();
    }
  });

  // modal submit
  async function onSaveWork(ev) {
    ev.preventDefault();
    const id = Number(workForm.dataset.id || 0);
    if (!id) return closeModal();

    const fd = new FormData(workForm);
    const description = String(fd.get('description') || '').trim();
    const materials = String(fd.get('materials') || '').trim();
    const costStr = String(fd.get('cost') || '').trim().replace(',', '.');

    if (!description || !costStr || isNaN(Number(costStr))) {
      say('Συμπλήρωσε περιγραφή και έγκυρο κόστος.');
      return;
    }

    $('#btnWorkSave')?.setAttribute('disabled', '');
    try {
      await api(`/api/appointments/${id}/works`, {
        method: 'POST',
        body: { description, materials, finished_at: null, cost: Number(costStr) }
      });
      closeModal();
      say('Η εργασία καταχωρήθηκε.');
      load();
    } catch (err) {
      console.error(err);
      say(err?.error || 'Αποτυχία προσθήκης εργασίας.');
    } finally {
      $('#btnWorkSave')?.removeAttribute('disabled');
    }
  }
})();

// ΦΙΛΙΚΑ LABELS
const TYPE_LABEL = {
  passenger: 'επιβατικό',
  truck: 'φορτηγό',
  van: 'βαν',
  suv: 'SUV',
  coupe: 'κουπέ',
  hatchback: 'hatchback'
};

// Φερ’ τα οχήματα για πολλά ids (δοκιμάζει /api/vehicles?ids=1,2,3 αλλιώς 1-1)
async function fetchVehiclesByIds(ids) {
  const out = new Map();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return out;

  // 1) προσπάθησε batch
  try {
    const res = await api(`/api/vehicles?ids=${uniq.join(',')}`);
    const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    for (const v of arr) out.set(Number(v.id), v);
    if (out.size === uniq.length) return out;
  } catch {}

  // 2) fallback: 1-1
  await Promise.all(uniq.map(async id => {
    if (out.has(id)) return;
    try {
      const v = await api(`/api/vehicles/${id}`);
      if (v) out.set(Number(v.id ?? id), v);
    } catch {}
  }));
  return out;
}

async function renderVehiclesFromAppointments(list){
  const box = document.getElementById('vehList');
  if (!box) return;

  // μαζεψε ids
  const ids = [];
  for (const a of (Array.isArray(list) ? list : [])) {
    const id = Number(a.vehicle_id || a.vehicle?.id || 0);
    if (id) ids.push(id);
  }
  // φέρε metadata
  const meta = await fetchVehiclesByIds(ids);

  // φτιάξε μοναδική λίστα
  const seen = new Map();
  for (const a of list) {
    const v = meta.get(Number(a.vehicle_id)) || a.vehicle || {};
    const id = Number(a.vehicle_id || v.id || 0) || null;

    const brand = (v.brand ?? v.make ?? a.brand ?? '').trim();
    const model = (v.model ?? a.model ?? '').trim();
    const label =
      (a.vehicle_model && String(a.vehicle_model).trim()) ||
      [brand, model].filter(Boolean).join(' ').trim() ||
      (v.serial || a.vehicle_serial || v.plate || (id ? `#${id}` : '—'));

    const typeRaw = String(v.car_type ?? v.type ?? '').toLowerCase();
    const type = TYPE_LABEL[typeRaw] || (typeRaw || '—');

    const engine = v.engine_type ?? v.engine ?? '';
    const doors  = v.doors;
    const wheels = v.wheels;
    const year   = v.acquisition_year ?? v.year;

    const key = id ?? `${label}::${type}`;
    if (!seen.has(key)) seen.set(key, { label, type, engine, doors, wheels, year });
  }

  const items = [...seen.values()];
  if (!items.length){
    box.innerHTML = '<div class="small">Δεν υπάρχουν σχετικά οχήματα</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid cols-3';
  for (const v of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="small" style="font-weight:600">${v.label}</div>
      <div class="small">Τύπος: ${v.type}</div>
      ${v.engine ? `<div class="small">Κινητήρας: ${v.engine}</div>` : ''}
      ${(v.doors ?? v.wheels) != null ? `<div class="small">Θύρες/Ρόδες: ${v.doors ?? '—'} / ${v.wheels ?? '—'}</div>` : ''}
      ${v.year ? `<div class="small">Έτος: ${v.year}</div>` : ''}
    `;
    grid.appendChild(card);
  }
  box.replaceChildren(grid);
}


