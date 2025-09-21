const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { notEmpty, isEmail } = require('../utils/validators');

router.post('/register', async (req, res) => {
  try{
    const { role, username, email, password, first_name, last_name, id_card, afm, address, specialty } = req.body;
    if (!['customer','mechanic'].includes(role)) return res.status(400).json({ error:'Invalid role' });
    if (!notEmpty(username) || !isEmail(email) || !notEmpty(password) || !notEmpty(first_name) || !notEmpty(last_name) || !notEmpty(id_card))
      return res.status(400).json({ error:'Missing fields' });

    const hash = await bcrypt.hash(password, 10);
    const conn = await db.getConnection();
    try{
      await conn.beginTransaction();
      const [uRes] = await conn.execute(
        `INSERT INTO users (role, username, email, password_hash, first_name, last_name, id_card, is_active)
         VALUES (?,?,?,?,?,?,?,0)`,
        [role, username, email, hash, first_name, last_name, id_card]
      );

      if (role === 'customer') {
        if (!notEmpty(afm) || !notEmpty(address)) throw new Error('Missing customer fields');
        await conn.execute(`INSERT INTO customers (user_id, afm, address) VALUES (?,?,?)`, [uRes.insertId, afm, address]);
      } else {
        if (!notEmpty(specialty)) throw new Error('Missing mechanic fields');
        await conn.execute(`INSERT INTO mechanics (user_id, specialty) VALUES (?,?)`, [uRes.insertId, specialty]);
      }
      await conn.commit();
      res.json({ message:'Registration submitted. Pending activation by secretary.' });
    } catch(e){
      await conn.rollback();
      res.status(400).json({ error:'Duplicate or invalid fields' });
    } finally {
      conn.release();
    }
  }catch(e){
    res.status(500).json({ error:'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await db.execute(`SELECT * FROM users WHERE username=?`, [username]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error:'Invalid credentials' });
  if (!user.is_active) return res.status(403).json({ error:'Account not active' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error:'Invalid credentials' });
  req.session.user = { id:user.id, role:user.role, name:`${user.first_name} ${user.last_name}` };
  res.json({ message:'Logged in', user:req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(()=>res.json({ message:'Logged out' }));
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;
