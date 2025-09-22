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

// Session (ΜΙΑ φορά, εδώ)
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
app.use('/api/auth',        require('./src/routes/auth.routes'));
app.use('/api/users',       require('./src/routes/users.routes'));   // <-- Ο σωστός router
app.use('/api/vehicles',    require('./src/routes/vehicles.routes'));
app.use('/api/appointments',require('./src/routes/appointments.routes'));
app.use('/api/uploads',     require('./src/routes/uploads.routes'));

// 🔒 Fallback για /api/users/me ώστε να ΜΗΝ ξαναβλέπεις 404
// (αν ο users router δεν φορτώσει για οποιονδήποτε λόγο)
app.get('/api/users/me', isAuthenticated, (req, res) => {
  // ελάχιστο προφίλ από τη συνεδρία (αρκετό για το UI)
  const u = req.session.user || {};
  res.json({
    id: u.id, username: u.username, email: u.email,
    first_name: u.first_name, last_name: u.last_name,
    role: u.role, is_active: u.is_active ?? 1, id_card: u.id_card || null
  });
});

// Static
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Redirect παλιού link
app.get(['/dashboard', '/dashboard/', '/dashboard/index.html'], (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard', 'secretary.html'));
});

// Health & Landing
app.get('/healthz', (_,res)=>res.json({ok:true}));
app.get('/', (_,res)=>res.sendFile(path.join(publicDir,'index.html')));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚗 AutoFix listening on http://localhost:${PORT}`));
