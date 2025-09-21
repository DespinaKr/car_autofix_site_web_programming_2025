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

// ==== TABS & δυναμικά πεδία για Register ====
(function initRegisterTabs(){
  const roleInput = document.getElementById('roleInput');
  if (!roleInput) return; // όχι στη σελίδα register

  const tabs = document.querySelectorAll('.tabs .tab');
  const customerFields = document.getElementById('customerFields');
  const mechanicFields = document.getElementById('mechanicFields');

  function setRole(r){
    roleInput.value = r;
    customerFields.classList.toggle('hidden', r !== 'customer');
    mechanicFields.classList.toggle('hidden', r !== 'mechanic');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.role === r));
  }
  tabs.forEach(t => t.addEventListener('click', () => setRole(t.dataset.role)));
  setRole('customer'); // default
})();

// ==== Υποβολή Register ====
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const payload = Object.fromEntries(fd.entries());

  // βασικοί έλεγχοι client-side
  if (!payload.first_name || !payload.last_name || !payload.username || !payload.email || !payload.id_card) {
    return toast('Συμπλήρωσε όλα τα υποχρεωτικά πεδία');
  }
  if (payload.password !== payload.password2) {
    return toast('Οι κωδικοί δεν ταιριάζουν');
  }
  delete payload.password2;

  // κράτα μόνο τα πεδία του ρόλου
  if (payload.role === 'customer') {
    delete payload.specialty;
    if (!payload.afm || !payload.address) {
      return toast('Για πελάτη απαιτούνται ΑΦΜ & Διεύθυνση');
    }
  } else if (payload.role === 'mechanic') {
    delete payload.afm; delete payload.address;
    if (!payload.specialty) return toast('Δώσε ειδικότητα μηχανικού');
  } else {
    return toast('Μη έγκυρος ρόλος');
  }

  try{
    await api('/api/auth/register', { method:'POST', body: payload });
    toast('Η εγγραφή στάλθηκε. Ενεργοποίηση από γραμματέα.');
    setTimeout(()=>location.href='/login.html', 800);
  }catch(err){
    toast(err.error || 'Σφάλμα εγγραφής');
  }
});
// ==== Homepage micro-interactions ====

// A) Counters όταν φανούν στην οθόνη
(function(){
  const els = document.querySelectorAll('.count');
  if (!els.length) return;
  const tick = (el, to, suffix) => {
    let cur = 0;
    const step = Math.max(1, Math.floor(to/60));
    const inc = () => {
      cur += step;
      if (cur >= to) cur = to;
      el.textContent = cur.toLocaleString() + (suffix||'');
      if (cur < to) requestAnimationFrame(inc);
    };
    inc();
  };
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if (e.isIntersecting) {
        const el = e.target;
        if (el.dataset.done) return;
        el.dataset.done = '1';
        tick(el, parseInt(el.dataset.to||'0',10), el.dataset.suffix||'');
      }
    });
  }, { threshold:.4 });
  els.forEach(el => io.observe(el));
})();

// B) Testimonials dots
(function(){
  const root = document.querySelector('.testi'); if (!root) return;
  const slides = Array.from(root.querySelectorAll('.slide'));
  const dots = Array.from(root.querySelectorAll('.dot'));
  let i = 0;
  const show = idx => {
    slides.forEach((s,j)=>s.classList.toggle('active', j===idx));
    dots.forEach((d,j)=>d.classList.toggle('active', j===idx));
    i = idx;
  };
  dots.forEach((d,idx)=> d.addEventListener('click',()=>show(idx)));
  setInterval(()=> show((i+1)%slides.length), 4800);
})();

// C) Parallax (πολύ διακριτικό)
(function(){
  const hero = document.querySelector('.hero-parallax'); if (!hero) return;
  hero.addEventListener('mousemove', (e)=>{
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left)/r.width - .5;
    const y = (e.clientY - r.top)/r.height - .5;
    const l = hero.querySelector('.hero-left');
    const rt = hero.querySelector('.hero-right');
    if (l) l.style.transform = `rotateY(${x*3}deg) rotateX(${ -y*3 }deg) translateZ(8px)`;
    if (rt) rt.style.transform = `rotateY(${x*6}deg) rotateX(${ -y*6 }deg) translateZ(14px)`;
  });
  hero.addEventListener('mouseleave', ()=>{
    const l = hero.querySelector('.hero-left');
    const rt = hero.querySelector('.hero-right');
    if (l) l.style.transform = '';
    if (rt) rt.style.transform = '';
  });
})();

// Show/Hide password (login & register) - σωστή κατεύθυνση εικονιδίων
(function () {
  const eye = () => (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
       <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
       <circle cx="12" cy="12" r="3.2"/>
     </svg>`
  );
  const eyeOff = () => (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
       <path d="M3 3l18 18"/>
       <path d="M1 12s4-7 11-7c2.2 0 4.2.6 5.8 1.6"/>
       <path d="M23 12s-4 7-11 7c-2.2 0-4.2-.6-5.8-1.6"/>
       <path d="M9.5 9.5a3.5 3.5 0 004.9 4.9"/>
     </svg>`
  );

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-toggle="password"]');
    if (!btn) return;

    const wrap = btn.closest('.input-wrap');
    const input = wrap ? wrap.querySelector('input[type="password"], input[type="text"]') : null;
    if (!input) return;

    // toggle
    const wasHidden = input.type === 'password';
    input.type = wasHidden ? 'text' : 'password';

    const nowShown = input.type === 'text';
    btn.setAttribute('aria-pressed', String(nowShown));
    // Εικονίδιο = κατάσταση ΤΩΡΑ (shown -> eye, hidden -> eyeOff)
    btn.innerHTML = nowShown ? eye() : eyeOff();
  });

  // Προαιρετικά: συγχρονισμός εικονιδίου στην αρχή (αν έχεις πολλές φόρμες)
  document.querySelectorAll('[data-toggle="password"]').forEach(btn => {
    const input = btn.closest('.input-wrap')?.querySelector('input');
    if (!input) return;
    const nowShown = input.type === 'text';
    btn.setAttribute('aria-pressed', String(nowShown));
    btn.innerHTML = nowShown ? eye() : eyeOff();
  });
})();





