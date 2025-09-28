(function(){
  'use strict'; // Ενεργοποίηση strict mode για πιο ασφαλές JS

  // Συντόμευση για querySelector
  const $=(s,r=document)=>r.querySelector(s);

  // Συνάρτηση εμφάνισης μηνύματος: προτιμά window.toast αλλιώς alert
  const say=(m)=> (window.toast?window.toast(m):alert(m));

  // Χάρτης μεταφράσεων κατάστασης ραντεβού -> ετικέτα
  const STATUS_LABEL={CREATED:'Δημιουργημένο',IN_PROGRESS:'Σε εξέλιξη',COMPLETED:'Περατωμένο',CANCELED:'Ακυρωμένο'};

  // Χάρτης κατάστασης ραντεβού -> CSS κλάση badge
  const STATUS_CLASS={CREATED:'blue',IN_PROGRESS:'orange',COMPLETED:'green',CANCELED:'red'};

  // Formatter ημερομηνίας/ώρας σε μορφή "d/m/y στις hh:mm"
  // Δέχεται dt ως ISO-like string (ή με κενό) και επιστρέφει φιλική αναπαράσταση
  const fmt=(dt)=>{
    if(!dt)return'—';
    const s=String(dt).replace(' ','T');
    const [d,t='']=s.split('T');
    const [y,m,d2]=d.split('-').map(Number);
    const [hh='00',mm='00']=t.split(':');
    return`${d2}/${m}/${y} στις ${hh}:${mm}`;
  };

  // Εκκίνηση σελίδας: φόρτωση χρήστη, ραντεβού και εργασιών, δέσιμο events
  async function boot(){
    // Πληροφορίες τρέχοντος χρήστη
    const me=await api('/api/auth/me').catch(()=>({}));
    const user=me?.user||me||{};

    // Απόδοση ονόματος χρήστη στο navbar (ή username ή '—')
    $('#navUser') && ($('#navUser').textContent=[user.first_name,user.last_name].filter(Boolean).join(' ')||user.username||'—');

    // Logout handler: κουμπί με data-action="logout"
    document.addEventListener('click',async(e)=>{
      const b=e.target.closest('[data-action="logout"]');
      if(!b)return;
      await api('/api/auth/logout',{method:'POST'});
      location.href='/login.html';
    });

    // Ανάγνωση id ραντεβού από query string (?id=)
    const q=new URLSearchParams(location.search); const id=Number(q.get('id')||0);
    if(!id){ say('Λείπει το id'); return; }

    // Ορισμός "πίσω" συνδέσμου ανά ρόλο χρήστη (αν υπάρχει #backLink)
    const back=$('#backLink');
    if(back){ back.href = user.role==='secretary' ? '/dashboard/secretary.html'
                     : user.role==='mechanic'  ? '/dashboard/mechanic.html'
                     : '/dashboard/customer.html'; }

    // Φόρτωση ραντεβού και απόδοση στο UI
    const appt=await api(`/api/appointments/${id}`);
    renderAppt(appt);

    // Φόρτωση εργασιών ραντεβού (αν αποτύχει, άφησε κενό)
    let works={items:[],total:0}; try{ works=await api(`/api/appointments/${id}/works`);}catch{}
    renderWorks(works);

    // Έλεγχος δικαιώματος προσθήκης εργασιών
    const canAdd=(user.role==='secretary')||(user.role==='mechanic'&&Number(user.id)===Number(appt.mechanic_id));
    const isInProgress=appt.status==='IN_PROGRESS';

    // Αν επιτρέπεται και το ραντεβού είναι σε εξέλιξη: εμφάνιση φόρμας και υποβολή
    if(canAdd && isInProgress){
      $('#workForm')?.classList.remove('hidden');
      $('#workForm')?.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const fd=new FormData(e.target);
        // Σώμα POST για νέα εργασία (materials και finished_at default)
        const body={ description:String(fd.get('description')||'').trim(), materials:'', finished_at:null,
          cost:Number(String(fd.get('cost')||'').replace(',','.'))||0 };
        try{
          // Καταχώριση εργασίας
          await api(`/api/appointments/${id}/works`,{method:'POST',body});
          say('Καταχωρήθηκε');
          // Επαναφόρτωση λίστας εργασιών και στοιχείων ραντεβού
          const updated=await api(`/api/appointments/${id}/works`); renderWorks(updated);
          const fresh=await api(`/api/appointments/${id}`); renderAppt(fresh);
          // Καθαρισμός φόρμας
          e.target.reset();
        }catch(err){ say(err?.error||'Σφάλμα'); }
      });
    }
  }

  // Απόδοση στοιχείων ραντεβού στο UI
  function renderAppt(a){
    // Τίτλος με κωδικό και μορφοποιημένη ημερομηνία/ώρα
    $('#apptTitle').textContent = `${a.appt_code||'APT'} — ${fmt(`${a.appt_date}T${String(a.appt_time||'').slice(0,5)}`)}`;
    // Badge κατάστασης
    $('#apptMeta').innerHTML = `<span class="badge ${STATUS_CLASS[a.status]||'blue'}">${STATUS_LABEL[a.status]||a.status}</span>`;
    // Πεδία σύνοψης
    $('#fCustomer').textContent=a.customer_name||'—';
    $('#fMechanic').textContent=a.mechanic_name||'—';
    $('#fVehicle').textContent=a.vehicle_model||'—';
    $('#fReason').textContent = a.reason==='service'?'Σέρβις':'Επιδιόρθωση';
    $('#fProblem').textContent=a.problem_desc||'—';
    $('#fCost').textContent=a.total_cost?`€${a.total_cost}`:'—';
  }

  // Απόδοση λίστας εργασιών (πίνακας) ή μήνυμα κενού
  function renderWorks(w){
    const box=$('#worksBox');
    if(!w.items?.length){ box.innerHTML='<div class="small">Δεν υπάρχουν εργασίες</div>'; return; }
    // Δημιουργία γραμμών πίνακα από τα items
    const rows=w.items.map(x=>`
      <tr>
        <td>${x.description||'-'}</td>
        <td>${x.materials||'-'}</td>
        <td>${x.finished_at?fmt(x.finished_at):'-'}</td>
        <td style="text-align:right">${Number(x.cost||0).toFixed(2)}</td>
      </tr>`).join('');
    // Πίνακας με thead / tbody / tfoot (σύνολο κόστους)
    box.innerHTML=`
      <table class="table">
        <thead><tr><th>Εργασία</th><th>Υλικά</th><th>Ολοκλήρωση</th><th style="text-align:right">Κόστος</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right"><b>Σύνολο</b></td><td style="text-align:right"><b>${Number(w.total||0).toFixed(2)}</b></td></tr></tfoot>
      </table>`;
  }

  // Εκκίνηση όταν φορτώσει το DOM
  window.addEventListener('DOMContentLoaded', boot);
})();
