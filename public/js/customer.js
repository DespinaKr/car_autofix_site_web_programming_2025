window.addEventListener('load', async ()=>{
  const me = await api('/api/auth/me');
  if (!me.user || me.user.role!=='customer') return location.href='/login.html';
  loadAppts(); loadVehicles();
});

async function loadAppts(){
  const { items } = await api('/api/appointments');
  const box = document.getElementById('appts');
  box.innerHTML = items.map(a => `
    <div class="card" style="margin:8px 0; display:grid; grid-template-columns: 1fr auto; gap:8px">
      <div>
        <div class="small">${a.appt_code} — ${a.appt_date} ${a.appt_time}</div>
        <div>${a.brand} ${a.model}</div>
        <div>Κατάσταση: <span class="badge status ${a.status==='CREATED'?'blue':a.status==='IN_PROGRESS'?'orange':a.status==='COMPLETED'?'green':'red'}">${fmtStatus(a.status)}</span></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <form onsubmit="return resched(event, ${a.id})" class="${a.status==='CREATED'?'':'hidden'}">
          <input class="input" type="date" name="appt_date" required>
          <input class="input" type="time" name="appt_time" required>
          <button class="btn">Αλλαγή</button>
        </form>
        ${a.status==='CREATED'?`<button class="btn ghost" onclick="cancelAppt(${a.id})">Ακύρωση</button>`:''}
      </div>
    </div>
  `).join('') || '<div class="small">Δεν υπάρχουν ραντεβού</div>';
}

async function resched(e, id){
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try{
    await api(`/api/appointments/${id}/reschedule`, { method:'PATCH', body: payload });
    toast('Ανανεώθηκε'); loadAppts();
  }catch(err){ toast(err.error||'Σφάλμα'); }
}

async function cancelAppt(id){
  if(!confirm('Ακύρωση ραντεβού;')) return;
  try{
    await api(`/api/appointments/${id}/cancel`, { method:'POST' });
    toast('Ακυρώθηκε'); loadAppts();
  }catch(err){ toast(err.error||'Σφάλμα'); }
}

async function loadVehicles(){
  const data = await api('/api/vehicles');
  const box = document.getElementById('vehicles');
  box.innerHTML = `<div class="grid cols-3">` + data.items.map(v => `
    <div class="card">
      <div class="small">${v.brand} ${v.model}</div>
      <div class="small">type: ${v.car_type} · engine: ${v.engine_type}</div>
      <div class="small">Doors/Wheels: ${v.doors} / ${v.wheels}</div>
      <div class="small">Year: ${v.acquisition_year}</div>
    </div>
  `).join('') + `</div>`;
}
