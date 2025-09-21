// public/js/secretary.js
// Secretary dashboard: KPIs & Recent Appointments (fixed HH:MM + proper today icon)

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const elUsers    = $('#statUsers');
  const elVehicles = $('#statVehicles');
  const elAppts    = $('#statAppointments');
  const elToday    = $('#statToday');
  const list       = $('#recentList');

  async function api(url, opts = {}) {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, ...opts });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
    return res.json().catch(() => ({}));
  }

  function putCount(node, to = 0) {
    if (!node) return;
    const end = Number(to) || 0;
    if (end <= 0) { node.textContent = '0'; return; }
    let cur = 0;
    const step = Math.max(1, Math.floor(end / 50));
    const tick = () => {
      cur += step; if (cur >= end) cur = end;
      node.textContent = cur.toLocaleString('el-GR');
      if (cur < end) requestAnimationFrame(tick);
    };
    tick();
  }

  // -------- SVG icons --------
  const calendarSVG = () => `
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor"
        d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v2H3V6a2 2 0 0 1 2-2h2V2zm14 8H3v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8zM7 14h4v4H7v-4z"/>
    </svg>`;
  const clockSVG = () => `
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 11.2-3.5-1.8V7h2v3.3l2.5 1.3-1 1.8Z"/>
    </svg>`;

  // -------- Helpers --------
  const pick = (o, keys) => keys.reduce((v, k) => (v ?? o?.[k]), null);

  // ΠΑΝΤΑ επέστρεψε HH:MM από ένα ραντεβού
  function extractHHMM(a = {}) {
    // 1) Αν υπάρχει καθαρό πεδίο ώρας, πάρε τα 5 πρώτα ψηφία (HH:MM)
    const timeField = pick(a, ['appt_time', 'time', 'start_time', 'appointment_time']);
    if (timeField) {
      const s = String(timeField);
      const m = s.match(/(\d{1,2}):(\d{2})/);
      if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    }
    // 2) Αλλιώς ψάξε ώρα μέσα σε ISO πεδίο
    const isoLike = pick(a, ['startsAt', 'datetime', 'start']);
    if (isoLike) {
      const s = String(isoLike);
      const m = s.match(/(?:T| )([01]?\d|2[0-3]):([0-5]\d)/);
      if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    }
    return ''; // τίποτα => μην δείχνεις " - 00:00"
  }

  function normalizeOverview(d) {
    if (!d) return null;
    const src = d.data && typeof d.data === 'object' ? d.data : d;
    return {
      users:        src.users ?? src.users_count ?? src.total_users ?? 0,
      vehicles:     src.vehicles ?? src.vehicles_count ?? src.total_vehicles ?? 0,
      appointments: src.appointments ?? src.appointments_count ?? src.total_appointments ?? 0,
      today:        src.today ?? src.today_count ?? src.today_appointments ?? 0,
      recent:       src.recent ?? src.latest ?? src.items ?? []
    };
  }

  function normalizeAppt(a = {}) {
    return {
      id:  a.id,
      who: a.customer_name || a.customer || a.client || '—',
      car: a.vehicle_model || a.vehicle || a.car || '',
      hhmm: extractHHMM(a) // <-- κύριο fix για τα 00:00
    };
  }

  function renderRecent(items = []) {
    if (!list) return;
    list.innerHTML = '';

    if (!Array.isArray(items) || items.length === 0) {
      const li = document.createElement('li');
      li.className = 'appt';
      li.innerHTML = `<div class="info"><div class="meta">Δεν υπάρχουν πρόσφατα ραντεβού.</div></div>`;
      list.appendChild(li);
      return;
    }

    const frag = document.createDocumentFragment();
    items.slice(0, 3).map(normalizeAppt).forEach(a => {
      const li = document.createElement('li');
      li.className = 'appt appt--ref';
      li.innerHTML = `
        <div class="av av--cal">${calendarSVG()}</div>
        <div class="info">
          <div class="who">${a.who}</div>
          <div class="meta">${a.car || '—'}${a.hhmm ? ' - ' + a.hhmm : ''}</div>
        </div>
      `;
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  // Αντικατάσταση του εικονιδίου στο "Σημερινά Ραντεβού"
  function decorateTodayIcon() {
    // Βρες *συγκεκριμένα* το container του εικονιδίου (δες βήμα HTML παρακάτω)
    const host = document.getElementById('statTodayIcon');
    if (!host) return;       // αν δεν υπάρχει id, δεν πειράζουμε τίποτα
    host.innerHTML = clockSVG();
    host.classList.add('is-svg-today');
  }

  async function loadData() {
    try {
      let raw = null;
      try { raw = await api('/api/secretary/overview'); } catch {}
      if (!raw) { try { raw = await api('/api/dashboard/secretary'); } catch {} }
      let data = normalizeOverview(raw) || {};

      if (data.users == null)        { try { const u = await api('/api/users/count');              data.users = u?.count ?? 0; } catch { data.users = 0; } }
      if (data.vehicles == null)     { try { const v = await api('/api/vehicles/count');           data.vehicles = v?.count ?? 0; } catch { data.vehicles = 0; } }
      if (data.appointments == null) { try { const a = await api('/api/appointments/count');       data.appointments = a?.count ?? 0; } catch { data.appointments = 0; } }
      if (data.today == null)        { try { const t = await api('/api/appointments/today/count'); data.today = t?.count ?? 0; } catch { data.today = 0; } }

      if (!Array.isArray(data.recent) || data.recent.length === 0) {
        try {
          const r = await api('/api/appointments?recent=3');
          data.recent = r?.items ?? r?.data ?? r ?? [];
        } catch { data.recent = []; }
      }

      putCount(elUsers, data.users);
      putCount(elVehicles, data.vehicles);
      putCount(elAppts, data.appointments);
      putCount(elToday, data.today);
      renderRecent(data.recent);

      decorateTodayIcon();
    } catch (err) {
      console.error('Secretary dashboard load error:', err);
      putCount(elUsers, 0);
      putCount(elVehicles, 0);
      putCount(elAppts, 0);
      putCount(elToday, 0);
      renderRecent([]);
      decorateTodayIcon();
    }
  }

  document.addEventListener('DOMContentLoaded', loadData);
})();
