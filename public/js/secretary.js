// Secretary dashboard: KPIs & πρόσφατα ραντεβού (με δυναμικά δεδομένα + solid fallbacks)
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  const elUsers = $('#statUsers');
  const elVehicles = $('#statVehicles');
  const elAppts = $('#statAppointments');
  const elToday = $('#statToday');
  const list = $('#recentList');

  const fmtTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  const animateCount = (node, to = 0) => {
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
  };

  const statusToPill = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('progress')) return { txt: 'Σε εξέλιξη',    cls: 'pill pill-orange' };
    if (s.includes('complete')) return { txt: 'Περατωμένο',   cls: 'pill pill-green'  };
    if (s.includes('create') || s.includes('draft') || s.includes('new'))
                                 return { txt: 'Δημιουργημένο',cls: 'pill pill-blue'   };
    if (s.includes('cancel'))   return { txt: 'Ακυρώθηκε',     cls: 'pill pill-gray'   };
    return { txt: status || '—', cls: 'pill pill-blue' };
  };

  const renderRecent = (items = []) => {
    list.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'appt';
      li.innerHTML = `<div class="info"><div class="meta">Δεν υπάρχουν πρόσφατα ραντεβού.</div></div>`;
      list.appendChild(li);
      return;
    }
    items.slice(0, 3).forEach(a => {
      const when = a.start_time || a.date || a.time || a.startsAt;
      const who  = a.customer_name || a.customer || a.client || '—';
      const car  = a.vehicle_model || a.vehicle || a.car || '';
      const st   = statusToPill(a.status || a.state);
      const li = document.createElement('li');
      li.className = 'appt';
      li.innerHTML = `
        <div class="av">
          <div class="t">${fmtTime(when)}</div>
          <div class="m"></div>
        </div>
        <div class="info">
          <div class="who">${who}</div>
          <div class="meta">${car ? car + ' · ' : ''}${fmtTime(when)}</div>
        </div>
        <span class="${st.cls}">${st.txt}</span>
      `;
      list.appendChild(li);
    });
  };


  const normalizeOverview = (d) => {
    if (!d) return null;
    // υποστήριξη διαφορετικών σχημάτων
    const obj = {
      users: d.users ?? d.users_count ?? d.total_users ?? 0,
      vehicles: d.vehicles ?? d.vehicles_count ?? d.total_vehicles ?? 0,
      appointments: d.appointments ?? d.appointments_count ?? d.total_appointments ?? 0,
      today: d.today ?? d.today_count ?? d.today_appointments ?? 0,
      recent: d.recent ?? d.latest ?? d.items ?? []
    };
    return obj;
  };

  const loadData = async () => {
    try {
      // 1) consolidated endpoint (πιο πιθανό)
      let raw = await api('/api/secretary/overview').catch(() => null);
      // 2) κοινή εναλλακτική
      if (!raw) raw = await api('/api/dashboard/secretary').catch(() => null);

      let data = normalizeOverview(raw);

      // 3) πλήρη fallbacks σε επιμέρους endpoints
      if (!data) {
        const [u, v, a, t, r] = await Promise.all([
          api('/api/users/count').catch(()=>null),
          api('/api/vehicles/count').catch(()=>null),
          api('/api/appointments/count').catch(()=>null),
          api('/api/appointments/today/count').catch(()=>null),
          api('/api/appointments?recent=3').catch(()=>null)
        ]);
        data = {
          users: u?.count ?? 0,
          vehicles: v?.count ?? 0,
          appointments: a?.count ?? 0,
          today: t?.count ?? 0,
          recent: r?.items ?? r ?? []
        };
      }


      animateCount(elUsers, data.users);
      animateCount(elVehicles, data.vehicles);
      animateCount(elAppts, data.appointments);
      animateCount(elToday, data.today);
      renderRecent(data.recent || []);
    } catch (err) {
      // Τελείως αποτυχημένο API -> demo
      animateCount(elUsers, DEMO.users);
      animateCount(elVehicles, DEMO.vehicles);
      animateCount(elAppts, DEMO.appointments);
      animateCount(elToday, DEMO.today);
      renderRecent(DEMO.recent);
      console.error('Secretary dashboard load error:', err);
    }
  };

  document.addEventListener('DOMContentLoaded', loadData);
})();
