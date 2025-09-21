const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');

function canManage(user, owner_id){
  return user.role === 'secretary' || user.id === owner_id;
}

// List/search
router.get('/', isAuthenticated, async (req, res) => {
  const q = (req.query.query||'').trim();
  const type = (req.query.type||'').trim();
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(50, Math.max(1, parseInt(req.query.size || '9')));
  const offset = (page-1)*size;

  const like = `%${q}%`;
  let sql = `SELECT v.*, CONCAT(u.first_name,' ',u.last_name) as owner_name 
             FROM vehicles v JOIN users u ON u.id=v.owner_id WHERE 1=1`;
  const params = [];
  if (q) { sql += ` AND (v.model LIKE ? OR v.brand LIKE ? OR v.serial_no LIKE ?)`; params.push(like, like, like); }
  if (type) { sql += ` AND v.car_type=?`; params.push(type); }
  if (req.session.user.role === 'customer') { sql += ` AND v.owner_id=?`; params.push(req.session.user.id); }
  sql += ` ORDER BY v.id DESC LIMIT ? OFFSET ?`; params.push(size, offset);

  const [items] = await db.execute(sql, params);

  res.json({ items, page, pages: 1 });
});

// Create
router.post('/', isAuthenticated, async (req, res) => {
  const u = req.session.user;
  let { owner_id, serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year } = req.body;
  owner_id = u.role==='customer'? u.id : Number(owner_id);
  if (!owner_id) return res.status(400).json({ error:'owner_id required' });

  try{
    await db.execute(
      `INSERT INTO vehicles (owner_id, serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [owner_id, serial_no, model, brand, car_type, engine_type, Number(doors), Number(wheels), production_date, Number(acquisition_year)]
    );
    res.json({ message:'Created' });
  }catch(e){
    res.status(400).json({ error:'Invalid fields or duplicate serial_no' });
  }
});

// Update
router.put('/:id', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const [[v]] = await db.execute(`SELECT owner_id FROM vehicles WHERE id=?`, [id]);
  if (!v) return res.status(404).json({ error:'Not found' });
  if (!canManage(req.session.user, v.owner_id)) return res.status(403).json({ error:'Forbidden' });

  const { serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year } = req.body;
  await db.execute(
    `UPDATE vehicles SET serial_no=?, model=?, brand=?, car_type=?, engine_type=?, doors=?, wheels=?, production_date=?, acquisition_year=? WHERE id=?`,
    [serial_no, model, brand, car_type, engine_type, Number(doors), Number(wheels), production_date, Number(acquisition_year), id]
  );
  res.json({ message:'Updated' });
});

// Delete
router.delete('/:id', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const [[v]] = await db.execute(`SELECT owner_id FROM vehicles WHERE id=?`, [id]);
  if (!v) return res.status(404).json({ error:'Not found' });
  if (!canManage(req.session.user, v.owner_id)) return res.status(403).json({ error:'Forbidden' });
  await db.execute(`DELETE FROM vehicles WHERE id=?`, [id]);
  res.json({ message:'Deleted' });
});

router.get('/count', isAuthenticated, hasRole('secretary'), async (_req, res) => {
  try {
    const [[{ c }]] = await db.execute('SELECT COUNT(*) AS c FROM vehicles');
    res.json({ count: c });
  } catch (err) {
    console.error('vehicles/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
