// public/js/secretary.js
// Secretary dashboard: KPIs & Recent Appointments (using existing endpoints)

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const elUsers    = $('#statUsers');
  const elVehicles = $('#statVehicles');
  const elAppts    = $('#statAppointments');
  const elToday    = $('#statToday');
  const list       = $('#recentList');

  // -------- Helpers --------
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

  // HH:MM extractor
  const pick = (o, keys) => keys.reduce((v, k) => (v ?? o?.[k]), null);
  function extractHHMM(a = {}) {
    const timeField = pick(a, ['start_time','appt_time','time','appointment_time']);
    if (timeField) {
      const s = String(timeField);
      const m = s.match(/(\d{1,2}):(\d{2})/);
      if (m) return `${m[1].padStart(2,'0')}:${m[2]}`;
    }
    const isoLike = pick(a, ['startsAt','datetime','start']);
    if (isoLike) {
      const s = String(isoLike);
      const m = s.match(/(?:T| )([01]?\d|2[0-3]):([0-5]\d)/);
      if (m) return `${m[1].padStart(2,'0')}:${m[2]}`;
    }
    return '';
  }

  // Recent renderer
  function renderRecent(items = []) {
    if (!list) return;
    list.innerHTML = '';

    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = '<li class="appt"><div class="info"><div class="meta">Δεν υπάρχουν πρόσφατα ραντεβού.</div></div></li>';
      return;
    }

    const frag = document.createDocumentFragment();
    items.slice(0, 3).forEach(a => {
      const li = document.createElement('li');
      li.className = 'appt appt--ref';
      const hhmm = extractHHMM(a);
      const who  = a.customer_name || a.customer || a.client || '—';
      const car  = a.vehicle_model || (a.make && a.model ? `${a.make} ${a.model}` : (a.vehicle || a.car || ''));
      li.innerHTML = `
        <div class="av av--cal">
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V9h14v11Z"/>
          </svg>
        </div>
        <div class="info">
          <div class="who"><b>${who}</b></div>
          <div class="meta">${car || '—'}${hhmm ? ' - ' + hhmm : ''}</div>
        </div>
      `;
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  // Σωστό εικονίδιο για "Σημερινά Ραντεβού" (αν υπάρχει host)
  function decorateTodayIcon() {
    const host = document.getElementById('statTodayIcon');
    if (!host) return;
    host.innerHTML = `
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M12 7v5l3 1.5" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    host.classList.add('is-svg-today');
  }

  async function loadData() {
    try {
      // Χρησιμοποιούμε το GLOBAL api() από /js/api.js (ΜΗΝ το ξαναορίσεις εδώ)
      const [u, v, a, t] = await Promise.all([
        api('/api/users/count'),
        api('/api/vehicles/count'),
        api('/api/appointments/count'),
        api('/api/appointments/today/count'),
      ]);

      // Recent: προσπάθησε με ?recent=3 → fallback σε limit=3
      let recent = [];
      try {
        const r = await api('/api/appointments?recent=3');
        recent = r?.items ?? r?.data ?? r ?? [];
      } catch {
        try {
          const r2 = await api('/api/appointments?limit=3&sort=desc');
          recent = r2?.items ?? r2?.data ?? r2 ?? [];
        } catch { recent = []; }
      }

      putCount(elUsers, u?.count ?? 0);
      putCount(elVehicles, v?.count ?? 0);
      putCount(elAppts, a?.count ?? 0);
      putCount(elToday, t?.count ?? 0);
      renderRecent(recent);
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
