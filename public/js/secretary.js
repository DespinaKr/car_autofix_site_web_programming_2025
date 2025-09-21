async function me(){ return (await api('/api/auth/me')).user; }
window.addEventListener('load', async ()=>{
  const u = await me();
  if (!u || u.role!=='secretary') return location.href='/login.html';

  // KPIs
  const users = await api('/api/users?size=1'); document.getElementById('kpiUsers').textContent = users.total;
  const vehs = await api('/api/vehicles?size=1'); document.getElementById('kpiVeh').textContent = vehs.items.length ? '—' : '—';
  const ap = await api('/api/appointments'); document.getElementById('kpiAp').textContent = ap.items.length;
  const today = new Date().toISOString().slice(0,10);
  const apToday = await api(`/api/appointments?from=${today}&to=${today}`); document.getElementById('kpiToday').textContent = apToday.items.length;

  // Recent
  const container = document.getElementById('recentAppts');
  container.innerHTML = ap.items.slice(0,3).map(a => `
    <div class="card" style="margin:8px 0; display:flex; justify-content:space-between; align-items:center">
      <div>
        <div class="small">${a.appt_code} — ${a.appt_date} at ${a.appt_time}</div>
        <div><b>${a.customer_name}</b> · ${a.brand} ${a.model}</div>
      </div>
      <span class="badge status ${a.status==='CREATED'?'blue':a.status==='IN_PROGRESS'?'orange':a.status==='COMPLETED'?'green':'red'}">${fmtStatus(a.status)}</span>
    </div>
  `).join('');

  // Profile
  document.getElementById('profileBox').innerHTML = `
    <div><b>${u.name}</b> <span class="badge green">Ενεργός</span></div>
    <div class="small">Ρόλος: Γραμματέας</div>
    <div class="small">User ID: ${u.id}</div>
  `;

  loadUsers(); loadVehicles(); loadAppts();
});

async function loadUsers(){
  const q = document.getElementById('userQ').value.trim();
  const role = (document.getElementById('userRole')||{value:''}).value;
  const data = await api(`/api/users?query=${encodeURIComponent(q)}`);
  const items = role? data.items.filter(u=>u.role===role) : data.items;
  const box = document.getElementById('usersList');
  box.innerHTML = items.map(u => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin:8px 0">
      <div>
        <div><b>${u.first_name} ${u.last_name}</b> — <span class="small">${u.username}</span></div>
        <div class="small">Ρόλος: ${u.role} · ΑΦΜ: ${u.afm||'-'} · Ειδικότητα: ${u.specialty||'-'}</div>
      </div>
      <div>
        <span class="badge ${u.is_active?'green':'red'}">${u.is_active?'Ενεργός':'Ανενεργός'}</span>
        <button class="btn ghost" onclick="toggleActive(${u.id}, ${u.is_active?0:1})">${u.is_active?'Απενεργοποίηση':'Ενεργοποίηση'}</button>
        <button class="btn ghost" onclick="delUser(${u.id})">Διαγραφή</button>
      </div>
    </div>
  `).join('') || '<div class="small">Κανένα αποτέλεσμα</div>';
}
async function toggleActive(id, active){ await api(`/api/users/${id}/activate`, { method:'PATCH', body:{ active } }); toast('OK'); loadUsers(); }
async function delUser(id){ if(!confirm('Διαγραφή;')) return; await api(`/api/users/${id}`, { method:'DELETE' }); toast('OK'); loadUsers(); }

async function loadVehicles(){
  const q = document.getElementById('vehQ').value.trim();
  const type = document.getElementById('vehType').value;
  const data = await api(`/api/vehicles?query=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`);
  const box = document.getElementById('vehiclesList');
  box.innerHTML = `<div class="grid cols-3">` + data.items.map(v => `
    <div class="card">
      <div class="small">${v.brand} ${v.model}</div>
      <div class="small">type: ${v.car_type} · engine: ${v.engine_type}</div>
      <div class="small">Doors/Wheels: ${v.doors} / ${v.wheels}</div>
      <div class="small">Year: ${v.acquisition_year}</div>
      <div class="small">Owner: ${v.owner_name}</div>
    </div>
  `).join('') + `</div>`;
}

function badge(s){
  const raw = s==='IN_PROGRESS'?'appointments.in_progress':s.toLowerCase();
  return `<span class="badge status ${s==='CREATED'?'blue':s==='IN_PROGRESS'?'orange':s==='COMPLETED'?'green':'red'}">${raw}</span>`;
}

async function loadAppts(){
  const params = new URLSearchParams();
  const f = document.getElementById('fFrom').value; if (f) params.append('from',f);
  const t = document.getElementById('fTo').value; if (t) params.append('to',t);
  const s = document.getElementById('fStatus').value; if (s) params.append('status',s);
  const q = document.getElementById('fQ').value.trim(); if (q) params.append('query',q);
  const data = await api(`/api/appointments?${params.toString()}`);
  document.getElementById('apptsList').innerHTML = data.items.map(a => `
    <div class="card" style="margin:8px 0; display:grid; grid-template-columns: 1fr auto; gap:8px">
      <div>
        <div class="small">${a.appt_code} — ${a.appt_date} at ${a.appt_time}</div>
        <div><b>${a.customer_name}</b> · ${a.brand} ${a.model}</div>
        <div class="small">${a.reason==='repair'?'Reason: Επιδιόρθωση':'Reason: Σέρβις'} ${a.problem_desc?('· '+a.problem_desc):''}</div>
        <div class="small">Κόστος: €${a.total_cost.toFixed(2)}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${badge(a.status)}
        <select class="input" style="width:auto" onchange="changeStatus(${a.id}, this.value)">
          <option value="">Κατάσταση…</option>
          <option value="CREATED">Δημιουργημένο</option>
          <option value="IN_PROGRESS">Σε εξέλιξη</option>
          <option value="COMPLETED">Περατωμένο</option>
        </select>
        <button class="btn ghost" onclick="cancelAppt(${a.id})">Ακύρωση</button>
      </div>
    </div>
  `).join('') || '<div class="small">Κανένα αποτέλεσμα</div>';
}
async function changeStatus(id, status){ if(!status) return; await api(`/api/appointments/${id}/status`, { method:'PATCH', body:{ status } }); toast('OK'); loadAppts(); }
async function cancelAppt(id){ if(!confirm('Ακύρωση ραντεβού;')) return; await api(`/api/appointments/${id}/cancel`, { method:'POST' }); toast('OK'); loadAppts(); }

function openCreateAppt(){
  const div = document.createElement('div');
  div.className='card'; div.style.cssText='position:fixed;right:20px;top:80px;max-width:420px;z-index:30';
  div.innerHTML = `
    <h3>Νέο Ραντεβού</h3>
    <form id="newApptForm">
      <label>Customer ID</label><input class="input" name="customer_id" required>
      <label>Vehicle ID</label><input class="input" name="vehicle_id" required>
      <div class="form-row">
        <div><label>Ημερομηνία</label><input type="date" class="input" name="appt_date" required></div>
        <div><label>Ώρα</label><input type="time" class="input" name="appt_time" required></div>
      </div>
      <label>Λόγος</label>
      <select class="input" name="reason"><option value="service">Σέρβις</option><option value="repair">Επιδιόρθωση</option></select>
      <label>Περιγραφή Προβλήματος</label><textarea class="input" name="problem_desc"></textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" style="flex:1">Δημιουργία</button>
        <button type="button" class="btn secondary" style="flex:1" onclick="this.closest('.card').remove()">Κλείσιμο</button>
      </div>
    </form>`;
  document.body.appendChild(div);
  div.querySelector('#newApptForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try{ await api('/api/appointments', { method:'POST', body: payload }); toast('OK'); loadAppts(); div.remove(); }
    catch(err){ toast(err.error || 'Σφάλμα'); }
  });
}

function promptAddUser(){
  const div = document.createElement('div');
  div.className='card'; div.style.cssText='position:fixed;right:20px;top:80px;max-width:520px;z-index:30';
  div.innerHTML = `
    <h3>Προσθήκη Χρήστη</h3>
    <form id="addUserForm">
      <div class="form-row">
        <div><label>Όνομα</label><input class="input" name="first_name" required></div>
        <div><label>Επώνυμο</label><input class="input" name="last_name" required></div>
      </div>
      <div class="form-row">
        <div><label>Username</label><input class="input" name="username" required></div>
        <div><label>Email</label><input class="input" name="email" required></div>
      </div>
      <label>Ρόλος</label>
      <select class="input" name="role" required onchange="document.querySelector('#afmAddr').classList.toggle('hidden', this.value!=='customer'); document.querySelector('#spec').classList.toggle('hidden', this.value!=='mechanic');">
        <option value="customer">Πελάτης</option>
        <option value="mechanic">Μηχανικός</option>
      </select>
      <div id="afmAddr">
        <div class="form-row">
          <div><label>ΑΦΜ</label><input class="input" name="afm"></div>
          <div><label>Διεύθυνση</label><input class="input" name="address"></div>
        </div>
      </div>
      <div id="spec" class="hidden"><label>Ειδικότητα</label><input class="input" name="specialty"></div>
      <div class="form-row">
        <div><label>Αρ. Ταυτότητας</label><input class="input" name="id_card" required></div>
        <div><label>Κωδικός</label><input type="password" class="input" name="password" required></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" style="flex:1">Αποθήκευση</button>
        <button type="button" class="btn secondary" style="flex:1" onclick="this.closest('.card').remove()">Κλείσιμο</button>
      </div>
    </form>`;
  document.body.appendChild(div);
  div.querySelector('#addUserForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try{ await api('/api/auth/register', { method:'POST', body: payload }); toast('Προστέθηκε'); div.remove(); loadUsers(); }
    catch(err){ toast(err.error||'Σφάλμα'); }
  });
}

function openAddVehicle(){
  const div = document.createElement('div');
  div.className='card'; div.style.cssText='position:fixed;right:20px;top:120px;max-width:520px;z-index:30';
  div.innerHTML = `
    <h3>Προσθήκη Οχήματος</h3>
    <form id="addVehForm">
      <div class="form-row">
        <div><label>Owner ID</label><input class="input" name="owner_id" required></div>
        <div><label>Serial</label><input class="input" name="serial_no" required></div>
      </div>
      <div class="form-row">
        <div><label>Brand</label><input class="input" name="brand" required></div>
        <div><label>Model</label><input class="input" name="model" required></div>
      </div>
      <div class="form-row">
        <div><label>Type</label><select class="input" name="car_type"><option value="passenger">passenger</option><option value="truck">truck</option><option value="bus">bus</option></select></div>
        <div><label>Engine</label><select class="input" name="engine_type"><option>electric</option><option>diesel</option><option>lpg</option><option>hybrid</option></select></div>
      </div>
      <div class="form-row">
        <div><label>Doors</label><input class="input" name="doors" type="number" required></div>
        <div><label>Wheels</label><input class="input" name="wheels" type="number" required></div>
      </div>
      <div class="form-row">
        <div><label>Production Date</label><input class="input" name="production_date" type="date" required></div>
        <div><label>Acquisition Year</label><input class="input" name="acquisition_year" type="number" required></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" style="flex:1">Αποθήκευση</button>
        <button type="button" class="btn secondary" style="flex:1" onclick="this.closest('.card').remove()">Κλείσιμο</button>
      </div>
    </form>`;
  document.body.appendChild(div);
  div.querySelector('#addVehForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try{ await api('/api/vehicles', { method:'POST', body: payload }); toast('Προστέθηκε'); div.remove(); loadVehicles(); }
    catch(err){ toast(err.error||'Σφάλμα'); }
  });
}
