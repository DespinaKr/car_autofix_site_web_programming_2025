const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// async handler wrapper (ίδιο με των άλλων routers)
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function canManage(user, owner_id) {
  return user.role === 'secretary' || user.id === owner_id;
}

async function tableExists(name) {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS c
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]
  );
  return Number(row.c) > 0;
}

// List/search
router.get('/', isAuthenticated, async (req, res) => {
  const q = (req.query.query || '').trim();
  const type = (req.query.type || '').trim();
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(50, Math.max(1, parseInt(req.query.size || '9')));
  const offset = (page - 1) * size;

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
// Create
router.post('/', isAuthenticated, async (req, res) => {
  const me = req.session.user;

  let { owner_id, owner_ref } = req.body || {};

  // --- mapping από τα ονόματα που στέλνει το frontend
  const serial_no = req.body.serial_no ?? req.body.serial ?? req.body.vin;
  const brand = req.body.brand ?? req.body.make;
  const model = (req.body.model || '').trim();
  const car_type = req.body.car_type ?? req.body.type;
  const engine_type = req.body.engine_type ?? req.body.engine;
  const doors = Number(req.body.doors ?? 0);
  const wheels = Number(req.body.wheels ?? 0);
  const production_date = req.body.production_date; // "YYYY-MM-DD"
  const acquisition_year = Number(req.body.acquisition_year ?? req.body.year ?? 0);

  try {
    // ποιος είναι ο ιδιοκτήτης;
    if (me.role === 'customer') {
      owner_id = me.id;
    } else {
      if (!owner_id && owner_ref) {
        const ref = String(owner_ref).trim();
        if (/^\d+$/.test(ref)) {
          owner_id = Number(ref);
        } else {
          const [[u]] = await db.execute('SELECT id FROM users WHERE username=?', [ref]);
          if (u) owner_id = u.id;
        }
      }
    }
    if (!owner_id) return res.status(400).json({ error: 'owner_id required' });

    // required πεδία
    if (!serial_no || !brand || !model || !car_type || !engine_type ||
      !doors || !wheels || !production_date || !acquisition_year) {
      return res.status(400).json({ error: 'Λείπουν υποχρεωτικά πεδία.' });
    }

    // μοναδικότητα serial_no
    const [[dup]] = await db.execute('SELECT id FROM vehicles WHERE serial_no=?', [serial_no]);
    if (dup) return res.status(409).json({ error: 'Ο σειριακός αριθμός υπάρχει ήδη.' });

    // insert
    const [r] = await db.execute(
      `INSERT INTO vehicles
         (owner_id, serial_no, model, brand, car_type, engine_type,
          doors, wheels, production_date, acquisition_year)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        owner_id, serial_no, model, brand, car_type, engine_type,
        doors, wheels, production_date, acquisition_year
      ]
    );

    // επέστρεψε created
    return res.status(201).json({ id: r.insertId, message: 'Created' });
  } catch (e) {
    console.error('vehicles POST', e);
    return res.status(400).json({ error: 'Invalid fields or duplicate serial_no' });
  }
});



// Update
router.put('/:id', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const [[v]] = await db.execute(`SELECT owner_id FROM vehicles WHERE id=?`, [id]);
  if (!v) return res.status(404).json({ error: 'Not found' });
  if (!canManage(req.session.user, v.owner_id)) return res.status(403).json({ error: 'Forbidden' });

  const { serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year } = req.body;
  await db.execute(
    `UPDATE vehicles SET serial_no=?, model=?, brand=?, car_type=?, engine_type=?, doors=?, wheels=?, production_date=?, acquisition_year=? WHERE id=?`,
    [serial_no, model, brand, car_type, engine_type, Number(doors), Number(wheels), production_date, Number(acquisition_year), id]
  );
  res.json({ message: 'Updated' });
});

// DELETE /api/vehicles/:id
router.delete('/:id', isAuthenticated, asyncH(async (req, res) => {
  const id = Number(req.params.id);

  // φέρε το όχημα (χωρίς να ζητάς ρητά customer_id)
  const [rows] = await db.execute(`SELECT * FROM vehicles WHERE id=?`, [id]);
  const v = rows[0];
  if (!v) return res.status(404).json({ error: 'Όχημα δεν βρέθηκε' });

  // ποιος είναι ο "ιδιοκτήτης" (schema-agnostic)
  const ownerId = v.owner_id ?? v.customer_id ?? v.user_id ?? null;

  // δικαιώματα: μόνο γραμματέας ή ο ιδιοκτήτης
  const me = req.session.user;
  if (me.role !== 'secretary' && Number(me.id) !== Number(ownerId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // καθάρισε works/appointments που δείχνουν στο όχημα (αν υπάρχουν)
  if (await tableExists('appointment_works')) {
    await db.execute(
      `DELETE aw FROM appointment_works aw
         JOIN appointments a ON a.id = aw.appointment_id
        WHERE a.vehicle_id = ?`, [id]
    );
  }
  await db.execute(`DELETE FROM appointments WHERE vehicle_id=?`, [id]);

  // τέλος: σβήσε το όχημα
  await db.execute(`DELETE FROM vehicles WHERE id=?`, [id]);

  res.json({ message: 'Deleted' });
}));



router.get('/count', isAuthenticated, hasRole('secretary'), async (_req, res) => {
  try {
    const [[{ c }]] = await db.execute('SELECT COUNT(*) AS c FROM vehicles');
    res.json({ count: c });
  } catch (err) {
    console.error('vehicles/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/vehicles/:id  (πλήρες όχημα)
router.get('/:id(\\d+)', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await db.execute(
    `SELECT v.id,
            v.serial_no,
            v.model,
            v.brand,
            v.car_type,
            v.engine_type,
            v.doors,
            v.wheels,
            v.production_date,
            v.acquisition_year,
            v.owner_id,
            u.username AS owner_username,
            CONCAT(u.first_name,' ',u.last_name) AS owner_name
     FROM vehicles v
     LEFT JOIN users u ON u.id = v.owner_id
     WHERE v.id = ?`,
    [id]
  );
  const v = rows[0];
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json(v);
});

// PATCH /api/vehicles/:id  (ενημέρωση στοιχείων)
router.patch('/:id(\\d+)', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);

  // Βρες το όχημα & έλεγξε δικαιώματα (γραμματέας ή ιδιοκτήτης)
  const [[cur]] = await db.execute(`SELECT owner_id FROM vehicles WHERE id=?`, [id]);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  if (req.session.user.role !== 'secretary' && req.session.user.id !== cur.owner_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // --- mapping από body (δέξου και τα δύο ονόματα)
  const serial_no = req.body.serial_no ?? req.body.serial ?? req.body.vin;
  const brand = req.body.brand ?? req.body.make;
  const model = req.body.model;
  const car_type = req.body.car_type ?? req.body.type;
  const engine_type = req.body.engine_type ?? req.body.engine;
  const doors = Number(req.body.doors ?? 0);
  const wheels = Number(req.body.wheels ?? 0);
  const production_date = req.body.production_date;
  const acquisition_year = Number(req.body.acquisition_year ?? req.body.year ?? 0);

  // --- required check (όλα υποχρεωτικά)
  if (!serial_no || !brand || !model || !car_type || !engine_type ||
    !doors || !wheels || !production_date || !acquisition_year) {
    return res.status(400).json({ error: 'Λείπουν υποχρεωτικά πεδία.' });
  }

  // --- μοναδικότητα serial_no
  const [[dup]] = await db.execute(
    `SELECT id FROM vehicles WHERE serial_no=? AND id<>?`,
    [serial_no, id]
  );
  if (dup) return res.status(409).json({ error: 'Ο σειριακός αριθμός υπάρχει ήδη.' });

  // --- update
  await db.execute(
    `UPDATE vehicles
       SET serial_no=?,
           model=?,
           brand=?,
           car_type=?,
           engine_type=?,
           doors=?,
           wheels=?,
           production_date=?,
           acquisition_year=?
     WHERE id=?`,
    [serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year, id]
  );

  // --- γύρνα πίσω το ενημερωμένο (με owner info)
  const [[v]] = await db.execute(
    `SELECT v.id,
            v.serial_no,
            v.model,
            v.brand,
            v.car_type,
            v.engine_type,
            v.doors,
            v.wheels,
            v.production_date,
            v.acquisition_year,
            v.owner_id,
            u.username AS owner_username,
            CONCAT(u.first_name,' ',u.last_name) AS owner_name
     FROM vehicles v
     LEFT JOIN users u ON u.id = v.owner_id
     WHERE v.id = ?`,
    [id]
  );
  res.json(v);
});

router.use((err, _req, res, _next) => {
  console.error('vehicles.routes error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});


module.exports = router;
