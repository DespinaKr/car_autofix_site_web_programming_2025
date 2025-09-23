(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const say=(m)=> (window.toast?window.toast(m):alert(m));
  const STATUS_LABEL={CREATED:'Δημιουργημένο',IN_PROGRESS:'Σε εξέλιξη',COMPLETED:'Περατωμένο',CANCELED:'Ακυρωμένο'};
  const STATUS_CLASS={CREATED:'blue',IN_PROGRESS:'orange',COMPLETED:'green',CANCELED:'red'};
  const fmt=(dt)=>{if(!dt)return'—';const s=String(dt).replace(' ','T');const [d,t='']=s.split('T');const [y,m,d2]=d.split('-').map(Number);const [hh='00',mm='00']=t.split(':');return`${d2}/${m}/${y} στις ${hh}:${mm}`;};

  async function boot(){
    const me=await api('/api/auth/me').catch(()=>({}));
    const user=me?.user||me||{};
    $('#navUser') && ($('#navUser').textContent=[user.first_name,user.last_name].filter(Boolean).join(' ')||user.username||'—');
    document.addEventListener('click',async(e)=>{const b=e.target.closest('[data-action="logout"]');if(!b)return;await api('/api/auth/logout',{method:'POST'});location.href='/login.html';});

    const q=new URLSearchParams(location.search); const id=Number(q.get('id')||0);
    if(!id){ say('Λείπει το id'); return; }

    // back link ανά ρόλο
    const back=$('#backLink');
    if(back){ back.href = user.role==='secretary' ? '/dashboard/secretary.html'
                     : user.role==='mechanic'  ? '/dashboard/mechanic.html'
                     : '/dashboard/customer.html'; }

    const appt=await api(`/api/appointments/${id}`);
    renderAppt(appt);

    let works={items:[],total:0}; try{ works=await api(`/api/appointments/${id}/works`);}catch{}
    renderWorks(works);

    const canAdd=(user.role==='secretary')||(user.role==='mechanic'&&Number(user.id)===Number(appt.mechanic_id));
    const isInProgress=appt.status==='IN_PROGRESS';
    if(canAdd && isInProgress){
      $('#workForm')?.classList.remove('hidden');
      $('#workForm')?.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const fd=new FormData(e.target);
        const body={ description:String(fd.get('description')||'').trim(), materials:'', finished_at:null,
          cost:Number(String(fd.get('cost')||'').replace(',','.'))||0 };
        try{
          await api(`/api/appointments/${id}/works`,{method:'POST',body});
          say('Καταχωρήθηκε');
          const updated=await api(`/api/appointments/${id}/works`); renderWorks(updated);
          const fresh=await api(`/api/appointments/${id}`); renderAppt(fresh);
          e.target.reset();
        }catch(err){ say(err?.error||'Σφάλμα'); }
      });
    }
  }

  function renderAppt(a){
    $('#apptTitle').textContent = `${a.appt_code||'APT'} — ${fmt(`${a.appt_date}T${String(a.appt_time||'').slice(0,5)}`)}`;
    $('#apptMeta').innerHTML = `<span class="badge ${STATUS_CLASS[a.status]||'blue'}">${STATUS_LABEL[a.status]||a.status}</span>`;
    $('#fCustomer').textContent=a.customer_name||'—';
    $('#fMechanic').textContent=a.mechanic_name||'—';
    $('#fVehicle').textContent=a.vehicle_model||'—';
    $('#fReason').textContent = a.reason==='service'?'Σέρβις':'Επιδιόρθωση';
    $('#fProblem').textContent=a.problem_desc||'—';
    $('#fCost').textContent=a.total_cost?`€${a.total_cost}`:'—';
  }

  function renderWorks(w){
    const box=$('#worksBox');
    if(!w.items?.length){ box.innerHTML='<div class="small">Δεν υπάρχουν εργασίες</div>'; return; }
    const rows=w.items.map(x=>`
      <tr>
        <td>${x.description||'-'}</td>
        <td>${x.materials||'-'}</td>
        <td>${x.finished_at?fmt(x.finished_at):'-'}</td>
        <td style="text-align:right">${Number(x.cost||0).toFixed(2)}</td>
      </tr>`).join('');
    box.innerHTML=`
      <table class="table">
        <thead><tr><th>Εργασία</th><th>Υλικά</th><th>Ολοκλήρωση</th><th style="text-align:right">Κόστος</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right"><b>Σύνολο</b></td><td style="text-align:right"><b>${Number(w.total||0).toFixed(2)}</b></td></tr></tfoot>
      </table>`;
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
