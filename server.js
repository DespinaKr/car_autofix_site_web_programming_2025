require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const vehiclesRoutes = require('./src/routes/vehicles.routes');
const appointmentsRoutes = require('./src/routes/appointments.routes');
const uploadsRoutes = require('./src/routes/uploads.routes');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "blob:", "https://source.unsplash.com", "https://images.unsplash.com"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'"]
    }
  }
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const store = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'autofix-secret',
  resave: false,
  saveUninitialized: false,
  store,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/uploads', uploadsRoutes);

app.get('/healthz', (_,res)=>res.json({ok:true}));

// Single Page-ish fallbacks
const publicDir = path.join(__dirname, 'public');
const landing = path.join(publicDir, 'index.html');
app.get('/', (_,res)=>res.sendFile(landing));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚗 AutoFix listening on http://localhost:${PORT}`));
