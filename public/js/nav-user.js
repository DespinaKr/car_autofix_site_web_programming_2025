// public/js/nav-user.js
(async function(){
  try {
    // Φέρνουμε τα στοιχεία του τρέχοντος χρήστη (endpoint "me")
    const me = await api('/api/users/me');

    // Βρίσκουμε το στοιχείο badge στη navbar
    const el = document.getElementById('navUser');

    // Αν υπάρχει το στοιχείο και λάβαμε χρήστη,
    // εμφάνισε "Όνομα Επώνυμο" (αν υπάρχουν), αλλιώς το username
    if (el && me) el.textContent = `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() || (me.username ?? '');
  } catch (_) {
    // Σιωπηλή αποτυχία: αν αποτύχει η κλήση, δεν κάνουμε τίποτα
  }
})();
