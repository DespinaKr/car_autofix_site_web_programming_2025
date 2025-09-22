// /js/secretary.vehicles.js
(function () {
    'use strict';
    const $ = (s, r = document) => r.querySelector(s);

    const grid = $('#vehGrid');
    const inp = $('#searchInput');
    const sel = $('#typeSelect');
    const total = $('#totalInfo');
    const page = $('#pageInfo');
    const prev = $('#btnPrev');
    const next = $('#btnNext');

    // header actions
    const btnAdd = $('#btnAddVehicle');
    const btnImp = $('#btnImport');
    const inFile = $('#importFile');

    // modal refs
    const modal = $('#vehModal');
    const form = $('#vehForm');
    const title = $('#vehModalTitle');
    const btnX = $('#vehClose');
    const btnCancel = $('#vehCancel');
    const ownerRow = $('#ownerRow');

    const state = {
        me: null,
        page: 1, size: 9, pages: 1,
        query: '', type: '',
        items: [], total: 0,
        editingId: null
    };

    // ----- helpers -----
    const pick = (o, keys) => keys.reduce((v, k) => (v ?? o?.[k]), null);
    const toNum = v => Number(v ?? 0) || 0;
    function fmtDate(d) {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt)) return String(d).slice(0, 10);
        return dt.toISOString().slice(0, 10);
    }
    function toInputDate(d) {
        if (!d) return '';
        const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const dt = new Date(d);
        return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
    }

    function normCar(x) {
        return {
            id: x.id ?? x.vehicle_id ?? x.ID,

            // VIN / σειριακός: πιάσε όλα τα πιθανά ονόματα
            serial: (x.serial || x.vin || x.vin_number || x.serial_number ||
                x.serial_no || x.serialNo || x.vehicle_serial || x.vehicle_vin ||
                x.chassis || x.chassis_no || x.chassis_number || x.frame_number ||
                x.vehicle_code || '').trim(),

            make: x.make ?? x.brand ?? '',
            model: x.model ?? x.vehicle_model ?? '',

            type: String(x.type ?? x.car_type ?? '').toLowerCase(),
            engine: String(x.engine ?? x.engine_type ?? '').toLowerCase(),

            doors: Number(x.doors ?? x.door_count ?? 0) || 0,
            wheels: Number(x.wheels ?? x.wheel_count ?? 0) || 0,

            // παραγωγή → σε μορφή input date
            production_date: toInputDate(x.production_date ?? x.manufactured_at ?? x.productionDate),

            // ΜΑΖΕΨΕ το "Έτος Κτήσης" (acquisition_year)
            year: Number(x.year ?? x.acquisition_year ?? x.acquired_year ?? 0) || 0,

            owner_id: x.owner_id ?? x.customer_id ?? x.user_id ?? null,
            owner_username: x.owner_username ?? x.username ?? x.ownerUser ?? null,
            owner_name: x.owner_name ?? x.customer_name ?? null,
        };
    }


    const TYPE_LABEL = { passenger: 'Επιβατικό', truck: 'Φορτηγό', bus: 'Λεωφορείο' };
    const ENGINE_LABEL = {
        electric: 'ηλεκτρικό', diesel: 'πετρέλαιο', petrol: 'βενζίνη',
        hybrid: 'υβριδικό', lpg: 'υγραέριο'
    };

    function canCreate() { return state.me?.role === 'secretary' || state.me?.role === 'customer'; }
    function canEdit(v) {
        if (state.me?.role === 'secretary') return true;
        if (state.me?.role === 'customer') return Number(v.owner_id) === Number(state.me.id);
        return false; // mechanic read-only
    }
    const canDelete = canEdit;

    const iEdit = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11a1.004 1.004 0 0 0 0-1.42l-2.54-2.54a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 2.04-2.04Z"/></svg>`;
    const iDel = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6v2h5v2H4V5h5V3Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM6 8h12l-1 13H7L6 8Z"/></svg>`;
    const iCar = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-5a1 1 0 0 1 1-1Zm3 0h8l-1-3H9Z"/></svg>`;

    function engineBadge(engine) {
        const e = String(engine || '').toLowerCase();
        const cls = e === 'electric' ? 'electric' : e === 'hybrid' ? 'hybrid' : '';
        const txt = ENGINE_LABEL[e] || e || '—';
        return `<span class="badge engine ${cls}">${txt}</span>`;
    }
    function typeBadge(type) {
        const t = String(type || '').toLowerCase();
        const txt = TYPE_LABEL[t] || type || '—';
        return `<span class="badge type">${txt}</span>`;
    }

    // ----- render -----
    function render() {
        grid.innerHTML = '';
        if (!state.items.length) {
            grid.innerHTML = `<div class="veh-card" style="grid-column:1/-1;color:#9fb1cf">Δεν βρέθηκαν οχήματα.</div>`;
            page.textContent = `Σελίδα ${state.page} / ${state.pages}`;
            prev.disabled = state.page <= 1; next.disabled = state.page >= state.pages;
            total.textContent = '';
            return;
        }
        const frag = document.createDocumentFragment();
        state.items.forEach(v => {
            const card = document.createElement('article');
            card.className = 'veh-card';
            const titleTxt = `${v.make || ''} ${v.model || ''}`.trim() || v.serial || '—';
            const sub = v.serial || (v.make || '') + (v.model ? ' ' : '') + (v.model || '');
            const acts = `
        <div class="actions" data-id="${v.id}">
          ${canEdit(v) ? `<button class="icon primary act-edit" title="Επεξεργασία">${iEdit}</button>` : ''}
          ${canDelete(v) ? `<button class="icon danger act-del" title="Διαγραφή">${iDel}</button>` : ''}
        </div>`;

            card.innerHTML = `
        <div class="top">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="icon" aria-hidden="true">${iCar}</div>
            <div class="veh-title">${titleTxt}</div>
          </div>
          ${acts}
        </div>
        <div class="veh-sub">${sub || ''}</div>

        <div class="row">
          <div>${typeBadge(v.type)}</div>
          <div>${engineBadge(v.engine)}</div>
          <div class="muted">Θύρες/Ρόδες: <b>${v.doors || '—'} / ${v.wheels || '—'}</b></div>
          <div class="muted">Έτος: <b>${v.year || '—'}</b></div>
          <div class="muted">Ιδιοκτήτης: <b>${v.owner_name || ('ID: ' + (v.owner_id ?? '—'))}</b></div>
          <div class="muted">Ημ/νία παραγωγής: <b>${fmtDate(v.production_date)}</b></div>
        </div>
      `;
            frag.appendChild(card);
        });
        grid.appendChild(frag);

        page.textContent = `Σελίδα ${state.page} / ${state.pages}`;
        prev.disabled = state.page <= 1; next.disabled = state.page >= state.pages;
        total.textContent = `${state.items.length} / ${state.total ?? state.items.length} οχήματα`;
    }

    // ----- load -----
    async function load() {
        let url = `/api/vehicles?query=${encodeURIComponent(state.query)}&page=${state.page}&size=${state.size}`;
        if (state.type) url += `&type=${encodeURIComponent(state.type)}`;
        if (state.me?.role === 'customer') url += `&mine=1`;

        const res = await api(url);
        let items = (res?.items || res?.data || res || []).map(normCar);

        if (state.me?.role === 'customer' && !items.some(x => x.owner_id === state.me.id)) {
            items = items.filter(x => Number(x.owner_id) === Number(state.me.id));
        }
        if (state.type) items = items.filter(x => String(x.type || '').toLowerCase() === state.type);

        state.items = items;
        state.pages = Math.max(1, res?.pages || 1);
        state.total = res?.total ?? items.length;
        render();
    }

    // ----- events -----
    let t = null;
    inp?.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { state.query = e.target.value.trim(); state.page = 1; load().catch(console.error); }, 250);
    });
    sel?.addEventListener('change', e => {
        state.type = e.target.value || '';
        state.page = 1; load().catch(console.error);
    });
    prev?.addEventListener('click', () => { if (state.page > 1) { state.page--; load().catch(console.error); } });
    next?.addEventListener('click', () => { if (state.page < state.pages) { state.page++; load().catch(console.error); } });

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('button.icon');
        if (!btn) return;
        const id = Number(btn.closest('.actions')?.dataset.id);
        const v = state.items.find(x => Number(x.id) === id);
        if (!v) return;

        if (btn.classList.contains('act-edit')) openModal(v);
        if (btn.classList.contains('act-del')) {
            if (!confirm('Διαγραφή οχήματος; Σχετικά ραντεβού θα διαγραφούν.')) return;
            api(`/api/vehicles/${id}`, { method: 'DELETE' })
                .then(() => { state.items = state.items.filter(x => x.id !== id); render(); })
                .catch(err => alert(err?.error || 'Αποτυχία διαγραφής.'));
        }
    });

    function openModal(v){
  state.editingId = v?.id ?? null;
  title.textContent = v ? `Επεξεργασία: ${v.make||''} ${v.model||''}`.trim() : 'Νέο Όχημα';

  (async () => {
    let data = v;
    if (v?.id) {             // <— EDIT: φέρε πλήρες από API
      try { data = await api(`/api/vehicles/${v.id}`); } catch {}
    }
    data = normCar(data || {});

    form.serial.value = data.serial || '';        // VIN / Serial
    form.make.value   = data.make   || '';
    form.model.value  = data.model  || '';
    form.type.value   = data.type   || 'passenger';
    form.engine.value = data.engine || 'diesel';
    form.doors.value  = data.doors  || '';
    form.wheels.value = data.wheels || '';
    form.production_date.value = toInputDate(data.production_date);
    form.year.value   = data.year   || '';        // acquisition_year mapped -> year

    // owner read-only στο edit
    const ownerRow = document.getElementById('ownerRow');
    const roRow    = document.getElementById('ownerReadonlyRow');
    const roLabel  = document.getElementById('ownerReadonly');

    if (state.me?.role === 'secretary') {
      if (state.editingId) {
        ownerRow.style.display = 'none';
        roRow.style.display = '';
        const u = data.owner_username ? `${data.owner_username}` : '';
        const idText = (data.owner_id!=null) ? ` (ID: ${data.owner_id})` : '';
        roLabel.textContent = (u || data.owner_name || `ID: ${data.owner_id ?? '—'}`) + (u && idText ? idText : '');
      } else {
        ownerRow.style.display = '';
        roRow.style.display = 'none';
        form.owner_ref.value = '';
      }
    } else {
      ownerRow.style.display = 'none';
      roRow.style.display = 'none';
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
  })();
}




    function closeModal() { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); state.editingId = null; }
    $('#vehClose')?.addEventListener('click', closeModal);
    $('#vehCancel')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });


    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            serial: form.serial.value.trim(),
            make: form.make.value.trim(),
            model: form.model.value.trim(),
            type: form.type.value,
            engine: form.engine.value,
            doors: Number(form.doors.value || 0),
            wheels: Number(form.wheels.value || 0),
            production_date: form.production_date.value, // YYYY-MM-DD
            year: Number(form.year.value || 0),
            acquisition_year: Number(form.year.value || 0),  // <— για τη στήλη της βάσης
        };


        const requiredOk = payload.serial && payload.make && payload.model && payload.type && payload.engine &&
            payload.doors && payload.wheels && payload.production_date && payload.year;
        if (!requiredOk) { alert('Συμπλήρωσε όλα τα υποχρεωτικά πεδία.'); return; }

        try {
            if (state.editingId) {
                // EDIT: δεν περνάμε owner_ref — δεν αλλάζει ο ιδιοκτήτης εδώ
                const updated = await api(`/api/vehicles/${state.editingId}`, { method: 'PATCH', body: payload });
                const idx = state.items.findIndex(x => x.id === state.editingId);
                if (idx >= 0) state.items[idx] = { ...state.items[idx], ...normCar(updated) };
            } else {
                // CREATE: μόνο εδώ επιτρέπουμε ορισμό ιδιοκτήτη
                if (state.me?.role === 'secretary') {
                    const ref = (form.owner_ref.value || '').trim();
                    if (ref) payload.owner_ref = ref; // id ή username
                } else if (state.me?.role === 'customer') {
                    payload.owner_id = state.me.id;
                }
                const created = await api(`/api/vehicles`, { method: 'POST', body: payload });
                state.items.unshift(normCar(created));
            }
            render(); closeModal();
        } catch (err) {
            alert(err?.error || 'Αποτυχία αποθήκευσης οχήματος.');
        }
    });


    // ----- import CSV -----
    function parseCSV(text) {
        // απλό CSV: header στην 1η γραμμή
        const lines = text.split(/\r?\n/).filter(l => l.trim().length);
        if (!lines.length) return [];
        const hdr = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            const o = {}; hdr.forEach((h, idx) => o[h] = cols[idx]);
            rows.push(o);
        }
        return rows;
    }

    async function importCSV(file) {
        if (!file) return;
        const txt = await file.text();
        const rows = parseCSV(txt);

        // αναμενόμενα header ονόματα (αν έρθουν άλλα, κάνουμε tolerant mapping)
        // serial,make,model,type,engine,doors,wheels,production_date,year,owner_ref
        let ok = 0, skip = 0;
        for (const r of rows) {
            const p = {
                serial: r.serial || r.vin,
                make: r.make, model: r.model,
                type: (r.type || '').toLowerCase(),
                engine: (r.engine || '').toLowerCase(),
                doors: Number(r.doors || 0), wheels: Number(r.wheels || 0),
                production_date: r.production_date,
                year: Number(r.year || r.acquisition_year || 0),
                acquisition_year: Number(r.year || r.acquisition_year || 0),
            };

            if (!p.serial || !p.make || !p.model || !p.type || !p.engine || !p.doors || !p.wheels || !p.production_date || !p.year) { skip++; continue; }
            if (state.me?.role === 'secretary' && r.owner_ref) p.owner_ref = r.owner_ref;
            if (state.me?.role === 'customer') p.owner_id = state.me.id;

            try {
                const created = await api('/api/vehicles', { method: 'POST', body: p });
                state.items.unshift(normCar(created)); ok++;
            } catch (_) { skip++; }
        }
        render();
        alert(`Εισαγωγή ολοκληρώθηκε.\nΠροστέθηκαν: ${ok}\nΑγνοήθηκαν: ${skip}`);
    }

    btnImp?.addEventListener('click', () => inFile?.click());
    inFile?.addEventListener('change', e => importCSV(e.target.files?.[0]).catch(console.error));

    // init
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            state.me = await api('/api/users/me'); // για δικαιώματα/ορατότητα κουμπιών
            if (canCreate()) { btnAdd.style.display = ''; btnImp.style.display = ''; }
            btnAdd?.addEventListener('click', () => openModal(null));
            await load();
        } catch (err) { console.error('vehicles init', err); }
    });
})();

