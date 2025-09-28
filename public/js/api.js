// Γενική συνάρτηση API wrapper για fetch με JSON bodies/headers και χειρισμό session
async function api(path, { method='GET', body, headers } = {}) {
  const res = await fetch(path, {
    method,
    // Default JSON header, με δυνατότητα override/προσθήκης επιπλέον headers
    headers: { 'Content-Type': 'application/json', ...(headers||{}) },
    // Μετατροπή body σε JSON string μόνο αν υπάρχει
    body: body ? JSON.stringify(body) : undefined,
    // Συμπερίληψη cookies/session (same-origin ή cross-site με κατάλληλες ρυθμίσεις server)
    credentials: 'include',
    // Να μην χρησιμοποιείται cache για τις κλήσεις API
    cache: 'no-store'
  });

  // 204 No Content: επιστρέφουμε null (δεν υπάρχει σώμα απάντησης)
  if (res.status === 204) return null;

  // Έλεγχος για μη-επιτυχείς απαντήσεις (>=400)
  if (!res.ok) {
    // 401 Unauthorized: redirect στη σελίδα login, εκτός αν ήδη βρισκόμαστε εκεί
    if (res.status === 401 && !location.pathname.includes('/login')) {
      location.replace('/login.html');
      return;
    }
    // Προσπάθεια ανάγνωσης JSON σφάλματος από το response, αλλιώς χρησιμοποιούμε statusText
    let err; try { err = await res.json(); } catch(_) { err = { error: res.statusText }; }
    // Ρίχνουμε το αντικείμενο σφάλματος ώστε ο caller να το χειριστεί
    throw err;
  }

  // Ανάγνωση τύπου περιεχομένου για να αποφασίσουμε JSON vs text
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// Απλό toast μήνυμα: δημιουργεί div.toast, δείχνει μήνυμα και το αφαιρεί μετά από 2.5s
function toast(msg){
  const t=document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2500);
}

// Μορφοποίηση κατάστασης ραντεβού από κωδικό σε ελληνική ετικέτα (fallback: επιστρέφει την αρχική τιμή)
function fmtStatus(s){
  return {CREATED:'Δημιουργημένο',IN_PROGRESS:'Σε εξέλιξη',COMPLETED:'Περατωμένο',CANCELED:'Ακυρωμένο'}[s]||s;
}
