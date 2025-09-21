require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const app = express();

// 1) Security headers
app.use(helmet());

// 2) Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3) Sessions σε MySQL (για XAMPP)
const store = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true
});
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',   // ok για localhost same-origin
    secure: false      // ΜΗΝ το κάνεις true σε http
  }
}));

// 4) Static files από /public (όλο το UI στο :3000)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// 5) API routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/users', require('./src/routes/users.routes'));
app.use('/api/vehicles', require('./src/routes/vehicles.routes'));
app.use('/api/appointments', require('./src/routes/appointments.routes'));
app.use('/api/uploads', require('./src/routes/uploads.routes'));

app.get('/healthz', (_,res)=>res.json({ok:true}));

// 6) Landing
app.get('/', (_,res)=>res.sendFile(path.join(publicDir, 'index.html')));

// 7) Start στο :3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚗 AutoFix listening on http://localhost:${PORT}`));
