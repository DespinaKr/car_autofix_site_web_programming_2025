// public/js/customer.js
(function () {
  'use strict';

  const say = (m) => (window.toast ? window.toast(m) : alert(m));

  const STATUS_LABEL = {
    CREATED: 'Δημιουργημένο',
    IN_PROGRESS: 'Σε εξέλιξη',
    COMPLETED: 'Περατωμένο',
    CANCELED: 'Ακυρωμένο',
  };
  const STATUS_CLASS = {
    CREATED: 'blue',
    IN_PROGRESS: 'orange',
    COMPLETED: 'green',
    CANCELED: 'red',
  };

  const fmtStatus = (s) => STATUS_LABEL[s] || s || '—';

  function fmtDateTime(dt) {
    if (!dt) return '—';
    const s = String(dt).replace(' ', 'T');
    const [dPart, tPartRaw = ''] = s.split('T');
    const [y, m, d] = dPart.split('-').map(Number);
    const [hh = '00', mm = '00'] = tPartRaw.split(':');
    if (!y || !m || !d) return '—';
    return `${d}/${m}/${y} στις ${hh}:${mm}`;
  }

  function splitDT(v) {
    if (!v) return { date: '', time: '' };
    const s = String(v).replace(' ', 'T');
    const [date, timeRaw = ''] = s.split('T');
    return { date, time: timeRaw.slice(0, 5) };
  }

  async function api(url, opt = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opt,
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
    if (!res.ok) {
      let e; try { e = await res.json(); } catch { }
      throw e || new Error('Request failed');
    }
    try { return await res.json(); } catch { return {}; }
  }

  // ---------- init/auth ----------
  let CURRENT_USER_ID = null;
  window.addEventListener('load', async () => {
    try {
      const me = await api('/api/auth/me');
      const user = me?.user || me;
      if (!user || user.role !== 'customer') { location.href = '/login.html'; return; }
      CURRENT_USER_ID = user.id;

      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Πελάτης';
      const navUser = document.getElementById('navUser');
      if (navUser) navUser.textContent = fullName;

      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="logout"]');
        if (!btn) return;
        await api('/api/auth/logout', { method: 'POST' });
        location.href = '/login.html';
      });

      // open/close modals
      document.getElementById('btnNewAppt')?.addEventListener('click', openApptModal);
      document.getElementById('btnNewVehicle')?.addEventListener('click', openVehicleModal);
      document.querySelectorAll('[data-close]').forEach(b => {
        b.addEventListener('click', () => closeModal(b.getAttribute('data-close')));
      });

      // reason toggle
      document.getElementById('appt_reason')?.addEventListener('change', toggleProblem);

      // save handlers
      document.getElementById('btnApptSave')?.addEventListener('click', (e) => { e.preventDefault(); createAppt(); });
      document.getElementById('btnVehSave')?.addEventListener('click', (e) => { e.preventDefault(); createVehicle(); });

      await loadAppts();
      await loadVehicles(CURRENT_USER_ID);
    } catch (err) {
      console.error(err);
      location.href = '/login.html';
    }
  });

  function openModal(sel) {
    const m = document.querySelector(sel);
    if (!m) return;
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    // Focus στο 1ο πεδίο
    setTimeout(() => m.querySelector('input,select,textarea,button')?.focus(), 0);
  }

  function closeModal(sel) {
    const m = document.querySelector(sel);
    if (!m) return;
    m.setAttribute('aria-hidden', 'true');
    // Αν δεν έχει άλλο ανοιχτό modal, ξεκλείδωσε scroll
    if (!document.querySelector('.modal[aria-hidden="false"]')) {
      document.body.classList.remove('modal-open');
    }
  }

  function toggleProblem() {
    const reason = document.getElementById('appt_reason')?.value || 'service';
    const grp = document.getElementById('grp_problem');
    if (grp) grp.classList.toggle('hidden', reason !== 'repair');
  }

  // ---------- Appointments ----------
  async function loadAppts() {
    const box = document.getElementById('appts');
    if (!box) return;

    const res = await api('/api/appointments?status=ALL&recent=50');
    const items = Array.isArray(res?.items) ? res.items : [];

    if (!items.length) { box.innerHTML = '<div class="small">Δεν υπάρχουν ραντεβού</div>'; return; }

    const frag = document.createDocumentFragment();
    items.forEach(a => {
      const id = Number(a.id || a.appointment_id || a.ID);
      const code = a.appt_code || a.code || `APT#${id}`;
      const time5 = String(a.appt_time || '').slice(0, 5);
      const startsAt = a.startsAt || (a.appt_date && time5 ? `${a.appt_date}T${time5}` : '');
      const veh = (a.vehicle_model || [a.brand, a.model].filter(Boolean).join(' ')).trim() || '—';
      const mech = a.mechanic_name || '—';
      const st = a.status || 'CREATED';
      const sClass = STATUS_CLASS[st] || 'blue';

      const card = document.createElement('div');
      card.className = 'card';
      card.style.margin = '8px 0';
      card.style.display = 'grid';
      card.style.gridTemplateColumns = '1fr auto';
      card.style.gap = '8px';

      const left = document.createElement('div');
      left.innerHTML = `
        <div class="small">${code} — ${fmtDateTime(startsAt)}</div>
        <div>${veh}</div>
        <div>Μηχανικός: <strong>${mech}</strong></div>
        <div>Κατάσταση: <span class="badge status ${sClass}">${fmtStatus(st)}</span></div>`;

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '6px';
      right.style.alignItems = 'center';

      if (st === 'CREATED') {
        const form = document.createElement('form');
        form.onsubmit = (ev) => resched(ev, id);
        form.innerHTML = `
          <input class="input" type="date" name="appt_date" required>
          <input class="input" type="time" name="appt_time" required>
          <button class="btn">Αλλαγή</button>`;
        right.appendChild(form);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn ghost';
        cancelBtn.textContent = 'Ακύρωση';
        cancelBtn.onclick = () => cancelAppt(id);
        right.appendChild(cancelBtn);
      }

      card.appendChild(left);
      card.appendChild(right);
      frag.appendChild(card);
    });

    box.innerHTML = '';
    box.appendChild(frag);
  }

  async function resched(e, id) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/api/appointments/${id}/reschedule`, { method: 'PATCH', body: payload });
      say('Ανανεώθηκε'); loadAppts();
    } catch (err) { say(err?.error || 'Σφάλμα μεταπρογραμματισμού'); }
  }

  async function cancelAppt(id) {
    if (!confirm('Ακύρωση ραντεβού;')) return;
    try {
      await api(`/api/appointments/${id}/cancel`, { method: 'POST' });
      say('Ακυρώθηκε'); loadAppts();
    } catch (err) { say(err?.error || 'Σφάλμα ακύρωσης'); }
  }

  // --- Create appointment (απαίτηση εκφώνησης) ---
  async function createAppt() {
    const vehicle_id = Number(document.getElementById('appt_vehicle')?.value || 0);
    const dt = document.getElementById('appt_dt')?.value || '';
    const reason = document.getElementById('appt_reason')?.value || 'service';
    const problem = document.getElementById('appt_problem')?.value?.trim() || null;

    const { date: appt_date, time: appt_time } = splitDT(dt);
    if (!vehicle_id || !appt_date || !appt_time) { say('Συμπλήρωσε όχημα & ημερομηνία/ώρα.'); return; }
    if (reason === 'repair' && !problem) { say('Περιέγραψε σύντομα το πρόβλημα.'); return; }

    try {
      await api('/api/appointments', {
        method: 'POST',
        body: { vehicle_id, appt_date, appt_time, reason, problem_desc: problem }
      });
      closeModal('#mAppt');
      say('Το ραντεβού δημιουργήθηκε.');
      await loadAppts();
    } catch (err) {
      say(err?.error || 'Αποτυχία δημιουργίας ραντεβού');
    }
  }

  // ---------- Vehicles ----------
  async function loadVehicles(userId) {
    const box = document.getElementById('vehicles');
    if (!box) return;

    // attempt owner_id then customer_id param (ανάλογα το router σου)
    let data;
    try { data = await api(`/api/vehicles?owner_id=${userId}`); }
    catch { data = await api(`/api/vehicles?customer_id=${userId}`); }

    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    renderVehicles(items);

    // γεμίζουμε και το dropdown του modal ραντεβού
    const sel = document.getElementById('appt_vehicle');
    if (sel) {
      sel.innerHTML = items.length
        ? items.map(v => {
          const label = [v.brand || v.make || '', v.model || ''].filter(Boolean).join(' ')
            || (v.serial || v.plate || `#${v.id}`);
          return `<option value="${v.id}">${label}</option>`;
        }).join('')
        : `<option value="">— δεν υπάρχουν οχήματα —</option>`;
      sel.disabled = !items.length;
    }
  }

  function renderVehicles(items) {
    const box = document.getElementById('vehicles');
    if (!box) return;
    if (!items.length) { box.innerHTML = '<div class="small">Δεν υπάρχουν οχήματα</div>'; return; }

    const grid = document.createElement('div');
    grid.className = 'grid cols-3';

    items.forEach(v => {
      const label = [v.brand || v.make || '', v.model || ''].filter(Boolean).join(' ')
        || (v.serial || v.plate || `#${v.id}`);
      const type = v.car_type || v.type || '—';
      const eng = v.engine_type || v.engine || '—';
      const doors = v.doors ?? '—';
      const wheels = v.wheels ?? '—';
      const year = v.acquisition_year ?? v.year ?? '—';

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="small" style="font-weight:600">${label}</div>
        <div class="small">type: ${type} · engine: ${eng}</div>
        <div class="small">Doors/Wheels: ${doors} / ${wheels}</div>
        <div class="small">Year: ${year}</div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="btn ghost" data-del="${v.id}">Διαγραφή</button>
        </div>`;

      // delete handler
      card.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή οχήματος; Θα διαγραφούν και σχετικά ραντεβού.')) return;
        try {
          // προτίμηση DELETE, fallback σε POST /delete αν το backend έτσι δουλεύει
          try { await api(`/api/vehicles/${v.id}`, { method: 'DELETE' }); }
          catch { await api(`/api/vehicles/${v.id}/delete`, { method: 'POST' }); }
          say('Διαγράφηκε.');
          await loadVehicles(CURRENT_USER_ID);
          await loadAppts(); // ανανέωση γιατί μπορεί να έσβησαν σχετικά ραντεβού
        } catch (err) {
          say(err?.error || 'Αποτυχία διαγραφής');
        }
      });

      grid.appendChild(card);
    });

    box.innerHTML = '';
    box.appendChild(grid);
  }

  // --- Create vehicle (μίνιμαλ) ---
  function openApptModal() {
    toggleProblem();
    // καθάρισμα
    document.getElementById('formAppt')?.reset();
    openModal('#mAppt');
  }
  function openVehicleModal() {
    document.getElementById('formVehicle')?.reset();
    openModal('#mVehicle');
  }

  async function createVehicle() {
    const brand = document.getElementById('veh_brand')?.value?.trim();
    const model = document.getElementById('veh_model')?.value?.trim();
    const type = document.getElementById('veh_type')?.value;          // π.χ. passenger
    const engine = document.getElementById('veh_engine')?.value;        // π.χ. gasoline/diesel
    const doors = parseInt(document.getElementById('veh_doors')?.value || '0', 10);
    const wheels = parseInt(document.getElementById('veh_wheels')?.value || '0', 10);
    const serial = document.getElementById('veh_serial')?.value?.trim(); // σειριακός/πλαίσιο
    const year = parseInt(document.getElementById('veh_year')?.value || '0', 10);
    const prodUI = document.getElementById('veh_prod_date')?.value?.trim(); // "YYYY-MM-DD" (αν υπάρχει input)

    // ---- validations ----
    if (!brand || !model || !type || !engine || !serial || !year || doors <= 0 || wheels <= 0) {
      say('Συμπλήρωσε όλα τα υποχρεωτικά πεδία.');
      return;
    }

    // production_date: απαιτείται από backend. Αν δεν υπάρχει input, πέσε σε ασφαλές fallback.
    const production_date = (/^\d{4}-\d{2}-\d{2}$/.test(prodUI) ? prodUI : `${year}-01-01`);

    // Στείλε όλα τα “συνηθισμένα” aliases ώστε να ταιριάζει σε ό,τι περιμένει ο server
    const body = {
      owner_id: Number(window.CURRENT_USER_ID),
      customer_id: Number(window.CURRENT_USER_ID),

      brand,
      model,

      car_type: type,
      type,

      engine_type: engine,
      engine,

      doors,
      wheels,

      serial,            // μερικοί routers το δέχονται ως "serial"
      serial_no: serial, // άλλοι ως "serial_no"
      vin: serial,       // ή "vin"

      production_date,          // <-- ΥΠΟΧΡΕΩΤΙΚΟ για το backend σου
      acquisition_year: year,
      year
    };

    const btn = document.getElementById('btnVehSave');
    if (btn) btn.disabled = true;

    try {
      await api('/api/vehicles', { method: 'POST', body });
      closeModal('#mVehicle');
      say('Το όχημα καταχωρήθηκε.');
      await loadVehicles(Number(window.CURRENT_USER_ID));
      // αν θέλεις, καθάρισε και τα πεδία φόρμας εδώ
    } catch (err) {
      console.error('createVehicle error:', err);
      say(err?.error || 'Αποτυχία προσθήκης οχήματος');
    } finally {
      if (btn) btn.disabled = false;
    }
  }


})();

