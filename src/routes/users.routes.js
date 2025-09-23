const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// -------- async error wrapper (να μη πέφτει ο server) --------
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// -------- helpers --------
function norm(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    id_card: u.id_card,
    role: u.role,
    is_active: Number(u.is_active) ? 1 : 0,
    afm: u.afm || null,
    address: u.address || null,
    specialty: u.specialty || null,
  };
}

async function getMeFull(uid) {
  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.id_card, u.role, u.is_active,
            c.afm, c.address, m.specialty
     FROM users u
     LEFT JOIN customers c ON c.user_id = u.id
     LEFT JOIN mechanics m ON m.user_id = u.id
     WHERE u.id = ?`,
    [uid]
  );
  return rows[0] || null;
}

// ---- dynamic password column detection ----
const PASS_COL_CANDIDATES = [
  'password', 'password_hash', 'passwd', 'pass', 'pwd', 'user_password', 'hashed_password'
];
let passwordColCache = null;

async function getPasswordColumn() {
  if (passwordColCache) return passwordColCache;
  const inList = PASS_COL_CANDIDATES.map(c => `'${c}'`).join(',');
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users'
       AND COLUMN_NAME IN (${inList})`
  );
  // προτίμησε 'password' αν υπάρχει, αλλιώς το πρώτο που βρέθηκε
  const found = rows.map(r => r.COLUMN_NAME);
  passwordColCache = found.includes('password') ? 'password' : (found[0] || 'password');
  return passwordColCache;
}

function looksHashed(s) {
  return typeof s === 'string' && /^\$2[aby]\$/.test(s); // bcrypt
}

// ---- PARTIAL PATCH: συμπλήρωση ότι λείπει από την τρέχουσα εγγραφή ----
async function updateUserCore(uid, payload) {
  const [[cur]] = await db.execute(
    'SELECT first_name,last_name,email,username,id_card FROM users WHERE id=?', [uid]
  );

  const first_name = (payload.first_name ?? cur?.first_name ?? '').trim();
  const last_name = (payload.last_name ?? cur?.last_name ?? '').trim();
  const email = (payload.email ?? cur?.email ?? '').trim();
  const username = (payload.username ?? cur?.username ?? '').trim();
  const id_card = (payload.id_card ?? payload.id_number ?? cur?.id_card ?? null);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!first_name || !last_name || !username || !emailRe.test(email)) {
    const e = new Error('Λάθος ή ελλιπή πεδία.'); e.status = 400; throw e;
  }

  if (username !== cur.username) {
    const [[u1]] = await db.execute('SELECT id FROM users WHERE username=? AND id<>?', [username, uid]);
    if (u1) { const e = new Error('Το username χρησιμοποιείται ήδη.'); e.status = 409; throw e; }
  }
  if (id_card && id_card !== cur.id_card) {
    const [[u2]] = await db.execute('SELECT id FROM users WHERE id_card=? AND id<>?', [id_card, uid]);
    if (u2) { const e = new Error('Ο Αριθμός Ταυτότητας υπάρχει ήδη.'); e.status = 409; throw e; }
  }

  await db.execute(
    'UPDATE users SET first_name=?, last_name=?, email=?, username=?, id_card=? WHERE id=?',
    [first_name, last_name, email, username, id_card || null, uid]
  );

  return { first_name, last_name, email, username, id_card };
}

// ---------- ME (ο ίδιος ο χρήστης) ----------
router.get('/me', isAuthenticated, asyncH(async (req, res) => {
  const data = await getMeFull(req.session.user.id);
  res.json(norm(data));
}));

router.patch('/me', isAuthenticated, asyncH(async (req, res) => {
  const uid = req.session.user.id;
  const role = req.session.user.role;

  await updateUserCore(uid, req.body || {});

  if (role === 'customer') {
    const afm = ('afm' in req.body) ? (req.body.afm || '') : '';
    const address = ('address' in req.body) ? (req.body.address || '') : '';
    if (afm && !/^\d{9}$/.test(String(afm))) return res.status(400).json({ error: 'Μη έγκυρο ΑΦΜ.' });
    await db.execute(
      `INSERT INTO customers (user_id, afm, address)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE afm=VALUES(afm), address=VALUES(address)`,
      [uid, afm, address]
    );
  } else if (role === 'mechanic') {
    const specialty = req.body.specialty || null;
    await db.execute(
      `INSERT INTO mechanics (user_id, specialty)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE specialty=VALUES(specialty)`,
      [uid, specialty]
    );
  }

  const updated = await getMeFull(uid);
  res.json(norm(updated));
}));

router.patch('/me/password', isAuthenticated, asyncH(async (req, res) => {
  const uid = req.session.user.id;
  const { current_password = '', new_password = '' } = req.body || {};
  if (new_password.length < 8) return res.status(400).json({ error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });

  const col = await getPasswordColumn(); // <-- δυναμικό όνομα στήλης
  const [[user]] = await db.execute(`SELECT \`${col}\` AS pwd FROM users WHERE id=?`, [uid]);
  if (!user) return res.status(404).json({ error: 'Χρήστης δεν βρέθηκε.' });

  const ok = looksHashed(user.pwd) ? await bcrypt.compare(current_password, user.pwd)
    : (current_password === user.pwd);
  if (!ok) return res.status(401).json({ error: 'Λάθος τρέχων κωδικός.' });

  const hash = await bcrypt.hash(new_password, 10);
  await db.execute(`UPDATE users SET \`${col}\`=? WHERE id=?`, [hash, uid]);
  res.json({ ok: true });
}));

// ---------- SEC ONLY ----------
router.patch('/:id', isAuthenticated, hasRole('secretary'), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  await updateUserCore(id, req.body || {});

  if ('afm' in (req.body || {}) || 'address' in (req.body || {})) {
    await db.execute(
      `INSERT INTO customers (user_id, afm, address)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE afm=VALUES(afm), address=VALUES(address)`,
      [id, req.body.afm || null, req.body.address || null]
    );
  }
  if ('specialty' in (req.body || {})) {
    await db.execute(
      `INSERT INTO mechanics (user_id, specialty)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE specialty=VALUES(specialty)`,
      [id, req.body.specialty || null]
    );
  }
  const data = await getMeFull(id);
  res.json(norm(data));
}));

router.patch('/:id/password', isAuthenticated, hasRole('secretary'), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const { new_password = '' } = req.body || {};
  if (new_password.length < 8) return res.status(400).json({ error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });

  const col = await getPasswordColumn();
  const hash = await bcrypt.hash(new_password, 10);
  await db.execute(`UPDATE users SET \`${col}\`=? WHERE id=?`, [hash, id]);
  res.json({ ok: true });
}));

// ---------- Υπάρχοντα endpoints ----------
router.get('/', isAuthenticated, hasRole('secretary'), asyncH(async (req, res) => {
  const q = (req.query.query || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(50, Math.max(1, parseInt(req.query.size || '10')));
  const offset = (page - 1) * size;

  const like = `%${q}%`;
  const [items] = await db.execute(
    `SELECT u.id, u.role, u.username, u.email, u.first_name, u.last_name, u.id_card, u.is_active,
            c.afm, c.address, m.specialty
     FROM users u
     LEFT JOIN customers c ON c.user_id=u.id
     LEFT JOIN mechanics m ON m.user_id=u.id
     WHERE (?='' OR u.username LIKE ? OR u.last_name LIKE ? OR c.afm LIKE ?)
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [q, like, like, like, size, offset]
  );
  const [[{ cnt }]] = await db.execute(
    `SELECT COUNT(*) cnt FROM users u LEFT JOIN customers c ON c.user_id=u.id
     WHERE (?='' OR u.username LIKE ? OR u.last_name LIKE ? OR c.afm LIKE ?)`,
    [q, like, like, like]
  );
  res.json({ items, page, pages: Math.ceil(cnt / size), total: cnt });
}));

router.patch('/:id/activate', isAuthenticated, hasRole('secretary'), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body;
  await db.execute('UPDATE users SET is_active=? WHERE id=?', [active ? 1 : 0, id]);
  res.json({ message: 'Updated' });
}));

router.delete('/:id', isAuthenticated, asyncH(async (req, res) => {
  const id = Number(req.params.id);
  if (req.session.user.role !== 'secretary' && req.session.user.id !== id)
    return res.status(403).json({ error: 'Forbidden' });
  await db.execute('DELETE FROM users WHERE id=?', [id]);
  res.json({ message: 'Deleted' });
}));

router.get('/count', isAuthenticated, hasRole('secretary'), asyncH(async (_req, res) => {
  const [[{ c }]] = await db.execute('SELECT COUNT(*) AS c FROM users');
  res.json({ count: c });
}));

// -------- generic error handler --------
router.use((err, _req, res, _next) => {
  console.error('users.routes error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

module.exports = router;
