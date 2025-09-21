const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Search users (secretary)
router.get('/', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const q = (req.query.query || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(50, Math.max(1, parseInt(req.query.size || '10')));
  const offset = (page-1)*size;

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
  const [[{cnt}]] = await db.execute(
    `SELECT COUNT(*) cnt FROM users u LEFT JOIN customers c ON c.user_id=u.id
     WHERE (?='' OR u.username LIKE ? OR u.last_name LIKE ? OR c.afm LIKE ?)`,
    [q, like, like, like]
  );
  res.json({ items, page, pages: Math.ceil(cnt/size), total: cnt });
});

// Activate/Deactivate
router.patch('/:id/activate', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body;
  await db.execute(`UPDATE users SET is_active=? WHERE id=?`, [active?1:0, id]);
  res.json({ message:'Updated' });
});

// Delete user (secretary or self)
router.delete('/:id', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  if (req.session.user.role !== 'secretary' && req.session.user.id !== id)
    return res.status(403).json({ error:'Forbidden' });
  await db.execute(`DELETE FROM users WHERE id=?`, [id]);
  res.json({ message:'Deleted' });
});

// COUNT (για secretary, ή βάλε τον ρόλο που χρειάζεσαι)
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