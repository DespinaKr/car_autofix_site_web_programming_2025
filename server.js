require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const { isAuthenticated } = require('./src/middleware/auth');

const SESSION_NAME = process.env.SESSION_NAME || 'autofix.sid';

const app = express();
app.set('trust proxy', 1);

// Security
app.use(helmet());

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
});
app.use(session({
  name: SESSION_NAME,
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

// API routes (πριν τα static)
app.use('/api/auth',         require('./src/routes/auth.routes'));
app.use('/api/users',        require('./src/routes/users.routes'));
app.use('/api/vehicles',     require('./src/routes/vehicles.routes'));
app.use('/api/appointments', require('./src/routes/appointments.routes'));
app.use('/api/uploads',      require('./src/routes/uploads.routes'));

// Fallback για /api/users/me (αν κάτι σπάσει, να μην γυρνάει 404)
app.get('/api/users/me', isAuthenticated, (req, res) => {
  const u = req.session.user || {};
  res.json({
    id: u.id, username: u.username, email: u.email,
    first_name: u.first_name, last_name: u.last_name,
    role: u.role, is_active: u.is_active ?? 1, id_card: u.id_card || null
  });
});

const publicDir = path.join(__dirname, 'public');

/* ============================
   🔒 GUARD για /dashboard
   ============================ */
function dashboardGuard(req, res, next) {
  const u = req.session?.user || null;
  const file = (req.path || '').split('?')[0]; // π.χ. '/', '/appointments.html'

  // όχι logged-in -> login
  if (!u) return res.redirect('/login.html');

  // /dashboard ή /dashboard/ -> redirect στο home με βάση ρόλο
  if (file === '/' || file === '') {
    const home =
      u.role === 'secretary' ? '/dashboard/secretary.html' :
      u.role === 'mechanic'  ? '/dashboard/mechanic.html'  :
      u.role === 'customer'  ? '/dashboard/customer.html'  :
      '/';
    return res.redirect(home);
  }

  // επιτρέπουμε assets (css/js/img/fonts/maps)
  if (/\.(css|js|png|jpe?g|webp|svg|ico|gif|map|woff2?|ttf|eot)$/i.test(file)) {
    return next();
  }

  // επιτρεπτές HTML σελίδες ανά ρόλο
  const allow = {
    secretary: new Set([
      '/secretary.html',      // Πίνακας Γραμματείας (όχι index!)
      '/appointments.html',
      '/vehicles.html',
      '/users.html',
      '/profile.html',
    ]),
    mechanic: new Set([
      '/mechanic.html',
      '/mechanic-profile.html',
      '/profile.html',
    ]),
    customer: new Set([
      '/customer.html',
      '/customer-profile.html',
      '/profile.html',
    ]),
  };

  if (allow[u.role]?.has(file)) return next();
  return res.status(403).send('Forbidden');
}

// 🔒 guard ΠΡΙΝ από το static
app.use(
  '/dashboard',
  dashboardGuard,
  express.static(path.join(publicDir, 'dashboard')) // ΕΔΩ: public/dashboard
);

// Γενικά static (landing, login, κοινά αρχεία)
app.use(express.static(publicDir));

// Health & Landing
app.get('/healthz', (_,res)=>res.json({ok:true}));
app.get('/',        (_,res)=>res.sendFile(path.join(publicDir,'index.html')));

// ❌ ΒΓΑΛΕ αυτό που είχες πριν:
// app.get(['/dashboard', '/dashboard/', '/dashboard/index.html'], (req, res) => {
//   res.sendFile(path.join(publicDir, 'dashboard', 'secretary.html'));
// });



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚗 AutoFix listening on http://localhost:${PORT}`));
