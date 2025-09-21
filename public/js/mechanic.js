window.addEventListener('load', async ()=>{
  const me = await api('/api/auth/me');
  if (!me.user || me.user.role!=='mechanic') return location.href='/login.html';
  load();
});
async function load(){
  const { items } = await api(`/api/appointments`);
  const list = document.getElementById('list');
  list.innerHTML = items.map(a => `
    <div class="card" style="margin:8px 0">
      <div class="small">${a.appt_date} ${a.appt_time} · ${a.appt_code}</div>
      <div><b>${a.customer_name}</b> — ${a.brand} ${a.model}</div>
      <div>${a.problem_desc||''}</div>
      <div>Κατάσταση: <span class="badge status ${a.status==='CREATED'?'blue':a.status==='IN_PROGRESS'?'orange':a.status==='COMPLETED'?'green':'red'}">${fmtStatus(a.status)}</span></div>
      ${a.status==='IN_PROGRESS'?`
        <form class="form-row" onsubmit="return addWork(event, ${a.id})">
          <input class="input" name="description" placeholder="Περιγραφή" required>
          <input class="input" name="materials" placeholder="Υλικά" required>
          <input class="input" name="finished_at" type="datetime-local" required>
          <input class="input" name="cost" type="number" step="0.01" placeholder="Κόστος" required>
          <button class="btn">Καταχώρηση Εργασίας</button>
        </form>`:''}
    </div>
  `).join('');
}
async function addWork(e, id){
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try{
    await api(`/api/appointments/${id}/works`, { method:'POST', body: payload });
    toast('OK'); load();
  }catch(err){ toast(err.error||'Σφάλμα'); }
}
