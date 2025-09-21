document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = e.target.username.value.trim();
  const password = e.target.password.value;
  try{
    const data = await api('/api/auth/login', { method:'POST', body:{ username, password } });
    if (data.user.role === 'secretary') location.href = '/dashboard/secretary.html';
    else if (data.user.role === 'mechanic') location.href = '/dashboard/mechanic.html';
    else location.href = '/dashboard/customer.html';
  }catch(err){
    toast(err.error || 'Σφάλμα σύνδεσης');
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  if (payload.role==='repair') return; // just in case
  try{
    await api('/api/auth/register', { method:'POST', body: payload });
    toast('Η εγγραφή στάλθηκε. Ενεργοποίηση από γραμματέα.');
    setTimeout(()=>location.href='/login.html', 800);
  }catch(err){
    toast(err.error || 'Σφάλμα εγγραφής');
  }
});
