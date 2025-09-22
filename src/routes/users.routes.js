const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// ---------- helpers ----------
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
    // extras
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

async function updateUserCore(uid, payload) {
  const first_name = (payload.first_name || '').trim();
  const last_name  = (payload.last_name  || '').trim();
  const email      = (payload.email      || '').trim();
  const username   = (payload.username   || '').trim();
  const id_card    = (payload.id_card || payload.id_number || '').trim() || null;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!first_name || !last_name || !username || !emailRe.test(email)) {
    const e = new Error('Λάθος ή ελλιπή πεδία.'); e.status = 400; throw e;
  }

  // μοναδικότητα username / id_card
  const [[u1]] = await db.execute(`SELECT id FROM users WHERE username=? AND id<>?`, [username, uid]);
  if (u1) { const e = new Error('Το username χρησιμοποιείται ήδη.'); e.status = 409; throw e; }

  if (id_card) {
    const [[u2]] = await db.execute(`SELECT id FROM users WHERE id_card=? AND id<>?`, [id_card, uid]);
    if (u2) { const e = new Error('Ο Αριθμός Ταυτότητας υπάρχει ήδη.'); e.status = 409; throw e; }
  }

  await db.execute(
    `UPDATE users SET first_name=?, last_name=?, email=?, username=?, id_card=? WHERE id=?`,
    [first_name, last_name, email, username, id_card, uid]
  );

  return { first_name, last_name, email, username, id_card };
}

// ---------- ME (ο ίδιος ο χρήστης) ----------
router.get('/me', isAuthenticated, async (req, res) => {
  const data = await getMeFull(req.session.user.id);
  res.json(norm(data));
});

router.patch('/me', isAuthenticated, async (req, res) => {
  const uid = req.session.user.id;
  const role = req.session.user.role;

  // core fields
  await updateUserCore(uid, req.body || {});

  // role extras
  if (role === 'customer') {
    const afm = req.body.afm || null;
    const address = req.body.address || null;
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
});

router.patch('/me/password', isAuthenticated, async (req, res) => {
  const uid = req.session.user.id;
  const { current_password = '', new_password = '' } = req.body || {};
  if (new_password.length < 8) return res.status(400).json({ error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });

  const [[user]] = await db.execute(`SELECT password FROM users WHERE id=?`, [uid]);
  if (!user) return res.status(404).json({ error: 'Χρήστης δεν βρέθηκε.' });

  const ok = await bcrypt.compare(current_password, user.password || '');
  if (!ok) return res.status(401).json({ error: 'Λάθος τρέχων κωδικός.' });

  const hash = await bcrypt.hash(new_password, 10);
  await db.execute(`UPDATE users SET password=? WHERE id=?`, [hash, uid]);
  res.json({ ok: true });
});

// ---------- SEC ONLY: edit άλλων χρηστών (προαιρετικό αλλά χρήσιμο) ----------
router.patch('/:id', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  await updateUserCore(id, req.body || {});
  // χειρισμός extras αν έρθουν
  if ('afm' in (req.body||{}) || 'address' in (req.body||{})) {
    await db.execute(
      `INSERT INTO customers (user_id, afm, address)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE afm=VALUES(afm), address=VALUES(address)`,
      [id, req.body.afm || null, req.body.address || null]
    );
  }
  if ('specialty' in (req.body||{})) {
    await db.execute(
      `INSERT INTO mechanics (user_id, specialty)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE specialty=VALUES(specialty)`,
      [id, req.body.specialty || null]
    );
  }
  const data = await getMeFull(id);
  res.json(norm(data));
});

router.patch('/:id/password', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { new_password = '' } = req.body || {};
  if (new_password.length < 8) return res.status(400).json({ error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });
  const hash = await bcrypt.hash(new_password, 10);
  await db.execute(`UPDATE users SET password=? WHERE id=?`, [hash, id]);
  res.json({ ok: true });
});

// ---------- Υπάρχοντα endpoints (μένουν ως έχουν) ----------

// Search users (secretary)
router.get('/', isAuthenticated, hasRole('secretary'), async (req, res) => {
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
});

// Activate/Deactivate
router.patch('/:id/activate', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body;
  await db.execute(`UPDATE users SET is_active=? WHERE id=?`, [active ? 1 : 0, id]);
  res.json({ message: 'Updated' });
});

// Delete user (secretary or self)
router.delete('/:id', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  if (req.session.user.role !== 'secretary' && req.session.user.id !== id)
    return res.status(403).json({ error: 'Forbidden' });
  await db.execute(`DELETE FROM users WHERE id=?`, [id]);
  res.json({ message: 'Deleted' });
});

// COUNT
router.get('/count', isAuthenticated, hasRole('secretary'), async (_req, res) => {
  try {
    const [[{ c }]] = await db.execute('SELECT COUNT(*) AS c FROM users');
    res.json({ count: c });
  } catch (err) {
    console.error('users/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
