// /js/profile.me.js
(function () {
    'use strict';

    // Συντομεύσεις για DOM επιλογές
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    // ---------- helpers ----------

    // Επιστρέφει badge HTML για ενεργό/ανενεργό (δέχεται boolean ή string με "ACT")
    const statusBadge = (activeOrStatus) => {
        const on = typeof activeOrStatus === 'string'
            ? activeOrStatus.toUpperCase().includes('ACT')
            : !!activeOrStatus;
        return `<span class="badge ${on ? 'green' : 'orange'}">${on ? 'Ενεργός' : 'Ανενεργός'}</span>`;
    };

    // Παράγει αρχικά ονόματος από πλήρες ονοματεπώνυμο
    const initials = (name) => {
        const p = String(name || '').trim().split(/\s+/).filter(Boolean);
        return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'CU';
    };

    // Απλό toast: αν δεν υπάρχει .toast στο DOM, κάνει alert
    function toast(msg) {
        const t = $('.toast');
        if (!t) { alert(msg); return; }
        t.textContent = msg; t.classList.remove('hidden'); t.style.opacity = '1';
        setTimeout(() => { t.style.opacity = '0'; }, 2000);
    }

    // ---------- normalize ----------
    // Κανονικοποίηση αντικειμένου χρήστη σε ομοιόμορφα κλειδιά που περιμένει το UI
    function normUser(u) {
        if (!u) return null;
        const first = u.first_name || u.firstName || '';
        const last = u.last_name || u.lastName || '';
        const full = u.full_name || [first, last].filter(Boolean).join(' ').trim()
            || u.username || 'Customer';
        return {
            id: u.id,
            role: u.role || u.user_role || 'customer',
            username: u.username || '',
            email: u.email || '',
            first_name: first,
            last_name: last,
            full_name: full,
            status: u.status || (u.is_active ? 'ACTIVE' : 'INACTIVE'),
            id_card: u.id_card || u.id_number || '',
            afm: u.afm || u.vat || u.vat_number || '',
            address: u.address || u.addr || '',
            // phone: u.phone || u.phone_number || u.tel || '', // αν υποστηριχθεί backend-ικά
        };
    }

    // ---------- refs ----------
    const btnEdit = $('#btnProfileEdit');
    const avatar = $('#profileAvatar');
    const statusEl = $('#profileStatus');
    const pwdForm = $('#pwdForm');

    // Λίστα πεδίων που αποδίδονται στο UI (πρέπει να υπάρχουν ως data-field στο HTML)
    const FIELD_KEYS = [
        'first_name', 'last_name', 'email', 'username',
        'id_card', 'afm', 'address',
        'full_name', 'status'
    ];

    // Κατάσταση module
    const state = { me: null, data: null, editing: false };

    // ---------- boot ----------
    // Εκκίνηση μετά το DOMContentLoaded
    window.addEventListener('DOMContentLoaded', init);

    async function init() {
        try {
            // Έλεγχος αυθεντικοποίησης: επιτρέπεται μόνο για role 'customer'
            const auth = await api('/api/auth/me');
            const me = auth?.user || auth;
            if (!me || me.role !== 'customer') { location.href = '/login.html'; return; }
            state.me = me;

            // Ενημέρωση εμφανιζόμενου ονόματος στο navbar
            const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username || 'Πελάτης';
            $('#navUser') && ($('#navUser').textContent = fullName);

            // Logout handler
            document.addEventListener('click', async (e) => {
                const b = e.target.closest('[data-action="logout"]');
                if (!b) return;
                await api('/api/auth/logout', { method: 'POST' });
                location.href = '/login.html';
            });

            // Απόπειρα ανάκτησης πλήρους προφίλ (fallback στο /api/auth/me αν αποτύχει)
            let raw = null;
            try {
                raw = await api('/api/users/me');
            } catch (_) {
                // αν αποτύχει, απλώς συνεχίζουμε με τα δεδομένα από /api/auth/me
            }
            const merged = { ...me, ...(raw || {}) }; // προτεραιότητα σε πεδία από /users/me
            state.data = normUser(merged);
            render(state.data);
        } catch (err) {
            console.error(err);
            location.href = '/login.html';
        }
    }

    // ---------- render ----------
    // Θέτει τιμή σε όλα τα στοιχεία με συγκεκριμένο data-field
    function setField(key, val) {
        $$(`[data-field="${key}"]`).forEach(el => {
            if (key === 'status') { el.innerHTML = statusBadge(val); return; }
            const txt = (val == null || String(val).trim() === '') ? '—' : String(val);
            el.textContent = txt;
            el.dataset.original = txt; // αποθήκευση αρχικής τιμής για diff στο save
        });
    }

    // Απόδοση όλων των πεδίων της καρτέλας προφίλ
    function render(d) {
        if (avatar) avatar.textContent = initials(d.full_name);
        if (statusEl) statusEl.innerHTML = statusBadge(d.status);
        FIELD_KEYS.forEach(k => setField(k, d[k]));
    }

    // ---------- edit / save ----------
    // Είσοδος σε κατάσταση επεξεργασίας: κουμπιά, inputs, φόρμα κωδικού
    function enterEdit() {
        state.editing = true;
        if (btnEdit) { btnEdit.textContent = 'Αποθήκευση'; btnEdit.classList.remove('ghost'); }
        if (!$('#btnProfileCancel')) {
            const cancel = document.createElement('button');
            cancel.id = 'btnProfileCancel';
            cancel.className = 'btn ghost';
            cancel.style.marginLeft = '8px';
            cancel.textContent = 'Άκυρο';
            btnEdit?.parentNode?.insertBefore(cancel, btnEdit.nextSibling);
            cancel.addEventListener('click', exitEdit);
        }
        // Μετατροπή εμφανίσιμων πεδίων σε input (μόνο για data-editable="true")
        $$('[data-field][data-editable="true"]').forEach(el => {
            if (el.querySelector('input')) return;
            const value = (el.textContent || '').trim();
            const input = document.createElement('input');
            input.className = 'input';
            input.value = (value === '—') ? '' : value;
            input.dataset.key = el.dataset.field;
            el.innerHTML = ''; el.appendChild(input);
        });
        pwdForm?.classList.remove('hidden'); // εμφάνιση φόρμας αλλαγής κωδικού
    }

    // Έξοδος από επεξεργασία: επαναφορά κειμένων, απόκρυψη φόρμας κωδικού
    function exitEdit() {
        state.editing = false;
        if (btnEdit) btnEdit.textContent = 'Επεξεργασία';
        $('#btnProfileCancel')?.remove();
        $$('[data-field][data-editable="true"]').forEach(el => {
            const inp = el.querySelector('input'); if (!inp) return;
            const v = inp.value.trim(); el.textContent = v || '—'; el.dataset.original = el.textContent;
        });
        pwdForm?.classList.add('hidden');
    }

    // Συλλογή αλλαγών (diff) από editable πεδία -> αντικείμενο patch
    function collectPatch() {
        const patch = {};
        $$('[data-field][data-editable="true"]').forEach(el => {
            const k = el.dataset.field;
            const val = el.querySelector('input')?.value ?? '';
            const original = el.dataset.original ?? '';
            const origClean = (original === '—') ? '' : original;

            if (val !== origClean) {
                if (k === 'afm') {
                    patch.afm = val;              // το backend δέχεται afm
                    // patch.vat_number = val;     // alias, αν χρειαστεί
                } else if (k === 'id_card') {
                    patch.id_card = val;
                    // patch.id_number = val;      // alias, αν χρειαστεί
                } else {
                    patch[k] = val;
                }
            }
        });
        return patch;
    }

    // Αποθήκευση αλλαγών προφίλ (PATCH /api/users/me)
    async function save() {
        const patch = collectPatch();
        if (Object.keys(patch).length === 0) { exitEdit(); return; }

        // Απλός έλεγχος email client-side
        if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) {
            alert('Μη έγκυρο email.'); return;
        }

        try {
            const updated = await api('/api/users/me', { method: 'PATCH', body: patch });
            state.data = normUser(updated);
            render(state.data);
            exitEdit();
            toast('Το προφίλ ενημερώθηκε.');
        } catch (err) {
            console.error(err);
            alert(err?.error || 'Αποτυχία ενημέρωσης προφίλ.');
        }
    }

    // ---------- change password ----------
    // Υποβολή φόρμας αλλαγής κωδικού: βασικοί έλεγχοι και κλήση API
    pwdForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(pwdForm);
        const current_password = String(fd.get('current') || '');
        const new_password = String(fd.get('next') || '');
        const confirm = String(fd.get('confirm') || '');

        if (!current_password || !new_password || !confirm) { alert('Συμπλήρωσε όλα τα πεδία.'); return; }
        if (new_password !== confirm) { alert('Οι νέοι κωδικοί δεν ταιριάζουν.'); return; }
        if (new_password.length < 8) { alert('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.'); return; }

        try {
            await api('/api/users/me/password', { method: 'PATCH', body: { current_password, new_password } });
            pwdForm.reset();
            toast('Ο κωδικός άλλαξε.');
        } catch (err) {
            console.error(err);
            alert(err?.error || 'Αποτυχία αλλαγής κωδικού.');
        }
    });

    // Εναλλαγή μεταξύ "Επεξεργασία" και "Αποθήκευση"
    btnEdit?.addEventListener('click', () => state.editing ? save() : enterEdit());
})();
