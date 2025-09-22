require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const SESSION_NAME = process.env.SESSION_NAME || 'autofix.sid';

const app = express();                   // 1) φτιάχνουμε ΠΡΩΤΑ το app
app.set('trust proxy', 1);

// 2) Security headers
app.use(helmet());

// 3) Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4) Sessions (MySQL store) – ΜΙΑ φορά, μετά τα parsers, πριν τα routes
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

// 5) API routes – ΤΩΡΑ γίνονται mount (έτσι /api/users/me δεν είναι 404)
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/users', require('./src/routes/users.routes'));
app.use('/api/vehicles', require('./src/routes/vehicles.routes'));
app.use('/api/appointments', require('./src/routes/appointments.routes'));
app.use('/api/uploads', require('./src/routes/uploads.routes'));

// 6) Static (public)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Προαιρετικά: παλιά links -> πίνακα γραμματέα
app.get(['/dashboard', '/dashboard/', '/dashboard/index.html'], (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard', 'secretary.html'));
});

// Health & Landing
app.get('/healthz', (_, res) => res.json({ ok: true }));
app.get('/',        (_, res) => res.sendFile(path.join(publicDir, 'index.html')));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚗 AutoFix listening on http://localhost:${PORT}`));
