// /js/secretary.vehicles.js
(function () {
    'use strict';
    // ----------------------------- Βοηθητικά / DOM refs -----------------------------
    const $ = (s, r = document) => r.querySelector(s); // σύντομο querySelector

    // Κύρια στοιχεία UI της σελίδας οχημάτων
    const grid = $('#vehGrid');          // grid όπου αποδίδονται οι κάρτες οχημάτων
    const inp = $('#searchInput');       // αναζήτηση (query)
    const sel = $('#typeSelect');        // φίλτρο τύπου οχήματος
    const total = $('#totalInfo');       // ένδειξη "εμφανίζονται/σύνολο"
    const page = $('#pageInfo');         // ένδειξη σελίδας
    const prev = $('#btnPrev');          // προηγούμενη σελίδα
    const next = $('#btnNext');          // επόμενη σελίδα

    // Κουμπιά header (εξαγωγή/εισαγωγή/νέο κλπ.)
    const btnAdd = $('#btnAddVehicle');  // άνοιγμα modal για νέο όχημα
    const btnImp = $('#btnImport');      // έναρξη import CSV
    const inFile = $('#importFile');     // file input για CSV

    // Αναφορές modal φόρμας
    const modal = $('#vehModal');
    const form = $('#vehForm');
    const title = $('#vehModalTitle');
    const btnX = $('#vehClose');
    const btnCancel = $('#vehCancel');
    const ownerRow = $('#ownerRow');     // πεδίο καθορισμού ιδιοκτήτη (μόνο σε CREATE από γραμματέα)

    // ----------------------------- Κατάσταση (state) -----------------------------
    const state = {
        me: null,                 // τρέχων χρήστης (για δικαιώματα)
        page: 1, size: 9, pages: 1,
        query: '', type: '',      // φίλτρα
        items: [], total: 0,      // δεδομένα/μετρητές
        editingId: null           // id προς επεξεργασία (null = create)
    };

    // ----------------------------- Βοηθητικές συναρτήσεις -----------------------------
    const pick = (o, keys) => keys.reduce((v, k) => (v ?? o?.[k]), null); // πάρε την 1η διαθέσιμη ιδιότητα από λίστα κλειδιών
    const toNum = v => Number(v ?? 0) || 0;                               // μετατροπή σε αριθμό με ασφαλές fallback

    // Μορφοποίηση ημερομηνίας για εμφάνιση (YYYY-MM-DD)
    function fmtDate(d) {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt)) return String(d).slice(0, 10);
        return dt.toISOString().slice(0, 10);
    }
    // Μετατροπή σε μορφή που δέχεται <input type="date">
    function toInputDate(d) {
        if (!d) return '';
        const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const dt = new Date(d);
        return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
    }

    // Κανονικοποίηση αντικειμένου οχήματος από πιθανώς διαφορετικά schema/backend πεδία
    function normCar(x) {
        return {
            id: x.id ?? x.vehicle_id ?? x.ID,

            // VIN/Serial — πιάσε όλα τα συνήθη alias
            serial: (x.serial || x.vin || x.vin_number || x.serial_number ||
                x.serial_no || x.serialNo || x.vehicle_serial || x.vehicle_vin ||
                x.chassis || x.chassis_no || x.chassis_number || x.frame_number ||
                x.vehicle_code || '').trim(),

            make: x.make ?? x.brand ?? '',                 // μάρκα
            model: x.model ?? x.vehicle_model ?? '',       // μοντέλο

            type: String(x.type ?? x.car_type ?? '').toLowerCase(),       // τύπος
            engine: String(x.engine ?? x.engine_type ?? '').toLowerCase(),// κινητήρας

            doors: Number(x.doors ?? x.door_count ?? 0) || 0,             // πόρτες
            wheels: Number(x.wheels ?? x.wheel_count ?? 0) || 0,          // ρόδες

            // ημ/νία παραγωγής → input value
            production_date: toInputDate(x.production_date ?? x.manufactured_at ?? x.productionDate),

            // έτος κτήσης (acquisition_year) → ενοποίηση σε year
            year: Number(x.year ?? x.acquisition_year ?? x.acquired_year ?? 0) || 0,

            owner_id: x.owner_id ?? x.customer_id ?? x.user_id ?? null,   // ιδιοκτήτης (id)
            owner_username: x.owner_username ?? x.username ?? x.ownerUser ?? null,
            owner_name: x.owner_name ?? x.customer_name ?? null,
        };
    }

    // Ετικέτες εμφάνισης για type/engine
    const TYPE_LABEL = { passenger: 'Επιβατικό', truck: 'Φορτηγό', bus: 'Λεωφορείο' };
    const ENGINE_LABEL = {
        electric: 'ηλεκτρικό', diesel: 'πετρέλαιο', petrol: 'βενζίνη',
        hybrid: 'υβριδικό', lpg: 'υγραέριο'
    };

    // Κανόνες δικαιωμάτων δημιουργίας/επεξεργασίας/διαγραφής (secretary: full, customer: own, mechanic: read-only)
    function canCreate() { return state.me?.role === 'secretary' || state.me?.role === 'customer'; }
    function canEdit(v) {
        if (state.me?.role === 'secretary') return true;
        if (state.me?.role === 'customer') return Number(v.owner_id) === Number(state.me.id);
        return false; // μηχανικός δεν επεξεργάζεται
    }
    const canDelete = canEdit; // ίδιος κανόνας με edit

    // Inline SVG εικονίδια
    const iEdit = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11a1.004 1.004 0 0 0 0-1.42λ-2.54-2.54a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 2.04-2.04Z"/></svg>`;
    const iDel = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6v2h5v2H4V5h5V3Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM6 8h12l-1 13H7L6 8Z"/></svg>`;
    const iCar = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-5a1 1 0 0 1 1-1Zm3 0h8l-1-3H9Z"/></svg>`;

    // Badge κινητήρα (με ειδική κλάση για electric/hybrid)
    function engineBadge(engine) {
        const e = String(engine || '').toLowerCase();
        const cls = e === 'electric' ? 'electric' : e === 'hybrid' ? 'hybrid' : '';
        const txt = ENGINE_LABEL[e] || e || '—';
        return `<span class="badge engine ${cls}">${txt}</span>`;
    }
    // Badge τύπου
    function typeBadge(type) {
        const t = String(type || '').toLowerCase();
        const txt = TYPE_LABEL[t] || type || '—';
        return `<span class="badge type">${txt}</span>`;
    }

    // ----------------------------- Απόδοση Grid -----------------------------
    function render() {
        grid.innerHTML = '';
        if (!state.items.length) {
            // Empty state
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

            // Τίτλος κάρτας (Make Model) ή Serial
            const titleTxt = `${v.make || ''} ${v.model || ''}`.trim() || v.serial || '—';
            const sub = v.serial || (v.make || '') + (v.model ? ' ' : '') + (v.model || '');

            // Ενέργειες κάρτας, με βάση τα δικαιώματα του τρέχοντος χρήστη
            const acts = `
        <div class="actions" data-id="${v.id}">
          ${canEdit(v) ? `<button class="icon primary act-edit" title="Επεξεργασία">${iEdit}</button>` : ''}
          ${canDelete(v) ? `<button class="icon danger act-del" title="Διαγραφή">${iDel}</button>` : ''}
        </div>`;

            // HTML περιεχόμενο κάρτας
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

        // ενημέρωση pager/μετρητών
        page.textContent = `Σελίδα ${state.page} / ${state.pages}`;
        prev.disabled = state.page <= 1; next.disabled = state.page >= state.pages;
        total.textContent = `${state.items.length} / ${state.total ?? state.items.length} οχήματα`;
    }

    // ----------------------------- Ανάκτηση δεδομένων από API -----------------------------
    async function load() {
        // Βασικό endpoint με query/page/size. Προσαρμόζουμε παραμέτρους ανά ρόλο/φίλτρα.
        let url = `/api/vehicles?query=${encodeURIComponent(state.query)}&page=${state.page}&size=${state.size}`;
        if (state.type) url += `&type=${encodeURIComponent(state.type)}`;
        if (state.me?.role === 'customer') url += `&mine=1`; // ζητάμε μόνο τα δικά μου

        const res = await api(url);
        // res μπορεί να είναι {items,pages,total} ή raw array — το φέρνουμε σε κοινό format με normCar
        let items = (res?.items || res?.data || res || []).map(normCar);

        // extra client-side φίλτρα ασφαλείας (αν το backend δεν σεβάστηκε πλήρως τις παραμέτρους)
        if (state.me?.role === 'customer' && !items.some(x => x.owner_id === state.me.id)) {
            items = items.filter(x => Number(x.owner_id) === Number(state.me.id));
        }
        if (state.type) items = items.filter(x => String(x.type || '').toLowerCase() === state.type);

        state.items = items;
        state.pages = Math.max(1, res?.pages || 1);
        state.total = res?.total ?? items.length;
        render();
    }

    // ----------------------------- Event listeners (φίλτρα/σελιδοποίηση/ενέργειες) -----------------------------
    // Debounce για αναζήτηση
    let t = null;
    inp?.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { state.query = e.target.value.trim(); state.page = 1; load().catch(console.error); }, 250);
    });
    // Αλλαγή τύπου
    sel?.addEventListener('change', e => {
        state.type = e.target.value || '';
        state.page = 1; load().catch(console.error);
    });
    // Pager
    prev?.addEventListener('click', () => { if (state.page > 1) { state.page--; load().catch(console.error); } });
    next?.addEventListener('click', () => { if (state.page < state.pages) { state.page++; load().catch(console.error); } });

    // Ενέργειες πάνω στις κάρτες (edit/delete) μέσω event delegation από το grid
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

    // ----------------------------- Modal: άνοιγμα για Create/Edit -----------------------------
    function openModal(v){
      state.editingId = v?.id ?? null; // null => create
      title.textContent = v ? `Επεξεργασία: ${v.make||''} ${v.model||''}`.trim() : 'Νέο Όχημα';

      (async () => {
        let data = v;
        if (v?.id) {             // EDIT: προσπάθησε να φέρεις full record
          try { data = await api(`/api/vehicles/${v.id}`); } catch {}
        }
        data = normCar(data || {});

        // Γέμισμα πεδίων φόρμας
        form.serial.value = data.serial || '';
        form.make.value   = data.make   || '';
        form.model.value  = data.model  || '';
        form.type.value   = data.type   || 'passenger';
        form.engine.value = data.engine || 'diesel';
        form.doors.value  = data.doors  || '';
        form.wheels.value = data.wheels || '';
        form.production_date.value = toInputDate(data.production_date);
        form.year.value   = data.year   || '';

        // Διαχείριση ιδιοκτήτη:
        //  - Secretary:
        //      * EDIT: ιδιοκτήτης "κλειδωμένος" (readonly row)
        //      * CREATE: εμφανίζεται input owner_ref για id/username
        //  - Customer: κρύβονται και τα δύο (πάντα δικό του)
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

        // Εμφάνιση modal
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden','false');
      })();
    }

    // Κλείσιμο modal & καθαρισμός state
    function closeModal() { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); state.editingId = null; }
    $('#vehClose')?.addEventListener('click', closeModal);
    $('#vehCancel')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // ----------------------------- Υποβολή φόρμας (Create/Update) -----------------------------
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Σώμα request (ενοποιημένα πεδία που περιμένει ο server)
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
            acquisition_year: Number(form.year.value || 0),  // ίδιο με year για βάσεις που το ζητούν
        };

        // Βασικός client-side έλεγχος υποχρεωτικών
        const requiredOk = payload.serial && payload.make && payload.model && payload.type && payload.engine &&
            payload.doors && payload.wheels && payload.production_date && payload.year;
        if (!requiredOk) { alert('Συμπλήρωσε όλα τα υποχρεωτικά πεδία.'); return; }

        try {
            if (state.editingId) {
                // EDIT: δεν αλλάζουμε ιδιοκτήτη μέσα από το edit
                const updated = await api(`/api/vehicles/${state.editingId}`, { method: 'PATCH', body: payload });
                const idx = state.items.findIndex(x => x.id === state.editingId);
                if (idx >= 0) state.items[idx] = { ...state.items[idx], ...normCar(updated) };
            } else {
                // CREATE: επιτρέπεται ορισμός ιδιοκτήτη μόνο:
                //  - secretary: μέσω owner_ref (id ή username)
                //  - customer: ο ίδιος ως owner_id
                if (state.me?.role === 'secretary') {
                    const ref = (form.owner_ref.value || '').trim();
                    if (ref) payload.owner_ref = ref;
                } else if (state.me?.role === 'customer') {
                    payload.owner_id = state.me.id;
                }
                const created = await api(`/api/vehicles`, { method: 'POST', body: payload });
                state.items.unshift(normCar(created)); // άμεση οπτική προσθήκη
            }
            render(); closeModal();
        } catch (err) {
            alert(err?.error || 'Αποτυχία αποθήκευσης οχήματος.');
        }
    });

    // ----------------------------- Import από CSV (προαιρετικό εργαλείο) -----------------------------
    // Πολύ απλό parser CSV (χωρίζουμε με κόμμα, χωρίς υποστήριξη για escaped quotes)
    function parseCSV(text) {
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

    // Εισαγωγή CSV: προσπαθεί να δημιουργήσει πολλά οχήματα σειριακά
    async function importCSV(file) {
        if (!file) return;
        const txt = await file.text();
        const rows = parseCSV(txt);

        // Αναμένονται headers: serial,make,model,type,engine,doors,wheels,production_date,year,owner_ref
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

            // Έλεγχος απαιτούμενων πεδίων
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

    // Κουμπιά εισαγωγής CSV (εμφανίζονται μόνο όταν επιτρέπεται create)
    btnImp?.addEventListener('click', () => inFile?.click());
    inFile?.addEventListener('change', e => importCSV(e.target.files?.[0]).catch(console.error));

    // ----------------------------- Εκκίνηση σελίδας -----------------------------
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            state.me = await api('/api/users/me');           // ποιος είμαι (για δικαιώματα)
            if (canCreate()) { btnAdd.style.display = ''; btnImp.style.display = ''; } // δείξε actions όπου επιτρέπεται
            btnAdd?.addEventListener('click', () => openModal(null)); // νέο όχημα
            await load();                                    // αρχική φόρτωση λίστας
        } catch (err) { console.error('vehicles init', err); }
    });
})();
