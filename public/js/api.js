async function api(path, { method='GET', body, headers } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers||{}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'            // 🔁 από 'same-origin' σε 'include'
  });
  if (!res.ok) {
    let err; try { err = await res.json(); } catch(_) { err = { error: res.statusText }; }
    throw err;
  }
  return res.json();
}

function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 2500); }
function fmtStatus(s){ return {CREATED:'Δημιουργημένο',IN_PROGRESS:'Σε εξέλιξη',COMPLETED:'Περατωμένο',CANCELED:'Ακυρωμένο'}[s]||s; }
