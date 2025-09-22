async function api(path, { method='GET', body, headers } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers||{}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    cache: 'no-store'
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    if (res.status === 401 && !location.pathname.includes('/login')) {
      location.replace('/login.html');
      return;
    }
    let err; try { err = await res.json(); } catch(_) { err = { error: res.statusText }; }
    throw err;
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}


function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 2500); }
function fmtStatus(s){ return {CREATED:'Δημιουργημένο',IN_PROGRESS:'Σε εξέλιξη',COMPLETED:'Περατωμένο',CANCELED:'Ακυρωμένο'}[s]||s; }
