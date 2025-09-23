const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { findAvailableMechanic } = require('../utils/scheduling');

// απλό log για debug
router.use((req, _res, next) => {
  console.log('[appointments]', req.method, req.originalUrl);
  next();
});

// --- async wrapper για να μη ρίχνουν τον server τα async errors
const asyncH = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// --- αν το hasRole σου δέχεται μόνο ένα ρόλο, χρησιμοποίησε αυτό:
const allowRoles = (...roles) => (req, res, next) => {
  const r = req.session?.user?.role;
  return roles.includes(r) ? next() : res.status(403).json({ error: 'Forbidden' });
};


function todayPerth() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' });
}
/* =========================
   LIST / SEARCH (μένει πρώτο)
   ========================= */
// LIST / SEARCH
router.get('/', isAuthenticated, async (req, res) => {
  const u = req.session.user;
  const { from, to, status, query } = req.query;
  const recent = parseInt(req.query.recent || '0', 10) || 0;

  const size = Math.max(1, Math.min(50, parseInt(req.query.size || '6', 10)));
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const offset = (page - 1) * size;

  let sql = `
    SELECT
      a.id, a.appt_code, a.customer_id, a.vehicle_id, a.mechanic_id,
      DATE_FORMAT(a.appt_date,'%Y-%m-%d') AS appt_date,
      TIME_FORMAT(a.appt_time,'%H:%i:%s') AS appt_time,
      a.status, a.reason, a.problem_desc, a.total_cost, a.created_at,
      CONCAT(IFNULL(c.first_name,''),' ',IFNULL(c.last_name,''))  AS customer_name,
      CONCAT(IFNULL(m.first_name,''),' ',IFNULL(m.last_name,''))  AS mechanic_name,
      CONCAT(IFNULL(v.brand,''),' ',IFNULL(v.model,''))           AS vehicle_model
    FROM appointments a
    LEFT JOIN users    c ON c.id = a.customer_id
    LEFT JOIN users    m ON m.id = a.mechanic_id
    LEFT JOIN vehicles v ON v.id = a.vehicle_id
    WHERE 1=1`;
  const params = [];

  if (from) { sql += ' AND a.appt_date >= ?'; params.push(from); }
  if (to) { sql += ' AND a.appt_date <= ?'; params.push(to); }

  if (status && status !== 'ALL') { sql += ' AND a.status = ?'; params.push(status); }

  if (query) {
    sql += ' AND (c.last_name LIKE ? OR c.id IN (SELECT user_id FROM customers WHERE afm LIKE ?))';
    const like = `%${query}%`;
    params.push(like, like);
  }

  if (u.role === 'customer') { sql += ' AND a.customer_id = ?'; params.push(u.id); }
  if (u.role === 'mechanic') { sql += ' AND a.mechanic_id = ?'; params.push(u.id); }

  // DEFAULT: μόνο όταν ΔΕΝ έχεις ημερομηνία/αναζήτηση/“recent”
  // - Αν status λείπει ή είναι ALL -> φίλτραρε στη ΣΗΜΕΡΙΝΗ μέρα (όλες οι καταστάσεις)
  // - Αν υπάρχει status -> ΜΗΝ βάζεις ημερομηνία (φέρε ΟΛΑ για αυτό το status)
  // --- ΒΓΑΛΤΟ ΤΕΛΕΙΩΣ ---
  // if (!from && !to && !query && !recent) {
  //   if (!status || status === 'ALL') {
  //     sql += ' AND a.appt_date = CURDATE()';
  //   }
  // }


  sql += recent
    ? ' ORDER BY a.created_at DESC, a.appt_date DESC, a.appt_time DESC, a.id DESC'
    : ' ORDER BY a.appt_date DESC, a.appt_time DESC, a.id DESC';

  sql += ' LIMIT ? OFFSET ?';
  params.push(size, offset);

  const [rows] = await db.execute(sql, params);

  const items = rows.map(r => {
    const time5 = String(r.appt_time || '').slice(0, 5);
    return { ...r, appt_time: time5, startsAt: `${r.appt_date}T${time5}` };
  });

  // (αν χρειάζεσαι total/pages, πρόσθεσε και δεύτερο COUNT(*) query)
  res.json({ items });
});


/* ======================================================
   COUNTS (μπαίνουν πριν από param routes για σιγουριά)
   ====================================================== */
router.get('/count', isAuthenticated, hasRole('secretary'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT COUNT(*) AS c FROM appointments';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    const [[{ c }]] = await db.execute(sql, params);
    res.json({ count: c });
  } catch (err) {
    console.error('appointments/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/today/count', isAuthenticated, hasRole('secretary'), async (req, res) => {
  try {
    const status = req.query.status || 'CREATED';
    const [[{ c }]] = await db.execute(
      `SELECT COUNT(*) AS c FROM appointments WHERE appt_date = CURDATE() AND status = ?`,
      [status]
    );
    res.json({ count: c, status, date: new Date().toISOString().slice(0, 10) });

  } catch (err) {
    console.error('appointments/today/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ======================================================
   ΕΙΔΙΚΑ routes ΠΡΙΝ από το γενικό /:id
   ====================================================== */

// Αλλαγή κατάστασης
router.patch('/:id/status', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['CREATED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const [r] = await db.execute(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'OK' });
});

// Καταχώρηση εργασιών (μόνο IN_PROGRESS)
// Auto-fill του finished_at αν λείπει (YYYY-MM-DD HH:MM:SS UTC)
router.post('/:id/works', isAuthenticated, hasRole('mechanic', 'secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { description, materials, finished_at, cost } = req.body;

  const [[a]] = await db.execute(`SELECT * FROM appointments WHERE id = ?`, [id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (req.session.user.role === 'mechanic' && req.session.user.id !== a.mechanic_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (a.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Μόνο όταν είναι IN_PROGRESS' });
  }

  const fin = finished_at
    ? String(finished_at)
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  await db.execute(
    `INSERT INTO works (appointment_id, description, materials, finished_at, cost)
     VALUES (?,?,?,?,?)`,
    [id, description || '-', materials || '', fin, Number(cost) || 0]
  );

  await db.execute(
    `UPDATE appointments
     SET total_cost = (SELECT COALESCE(SUM(cost),0) FROM works WHERE appointment_id = ?)
     WHERE id = ?`,
    [id, id]
  );
  res.json({ message: 'Καταχωρήθηκε εργασία' });
});

// Μεταπρογραμματισμός (μόνο CREATED)
router.patch('/:id/reschedule', isAuthenticated, hasRole('customer', 'secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { appt_date, appt_time } = req.body;

  const [[a]] = await db.execute(`SELECT * FROM appointments WHERE id = ?`, [id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (req.session.user.role === 'customer' && req.session.user.id !== a.customer_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (a.status !== 'CREATED') return res.status(400).json({ error: 'Only when status=CREATED' });

  const [h] = String(appt_time || '').split(':').map(Number);
  if (isNaN(h) || h < 8 || h > 14) {
    return res.status(400).json({ error: 'Ώρα 08:00–16:00 (διάρκεια 2h, τελευταίο ξεκίνημα 14:00)' });
  }

  const mech = await findAvailableMechanic(db, appt_date, appt_time);
  if (!mech) return res.status(409).json({ error: 'Δεν υπάρχει διαθέσιμος μηχανικός' });

  const [r] = await db.execute(
    `UPDATE appointments SET appt_date = ?, appt_time = ?, mechanic_id = ? WHERE id = ?`,
    [appt_date, appt_time, mech, id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Ανανεώθηκε' });
});

/* ======================================================
   PATCH /:id  (γενικό update)
   ====================================================== */
router.patch('/:id', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { customer_id, vehicle_id, appt_date, appt_time, reason, problem_desc, status } = req.body;

  if (appt_time) {
    const [h] = String(appt_time).split(':').map(Number);
    if (isNaN(h) || h < 8 || h > 14) {
      return res.status(400).json({ error: 'Ώρα 08:00–16:00 (διάρκεια 2h, τελευταίο 14:00)' });
    }
  }

  const fields = [];
  const params = [];
  if (customer_id != null) { fields.push('customer_id = ?'); params.push(Number(customer_id)); }
  if (vehicle_id != null) { fields.push('vehicle_id = ?'); params.push(Number(vehicle_id)); }
  if (appt_date) { fields.push('appt_date = ?'); params.push(appt_date); }
  if (appt_time) { fields.push('appt_time = ?'); params.push(appt_time); }
  if (reason) { fields.push('reason = ?'); params.push(reason); }
  if (problem_desc != null) { fields.push('problem_desc = ?'); params.push(problem_desc || null); }
  if (status) { fields.push('status = ?'); params.push(status); }

  if (!fields.length) return res.status(400).json({ error: 'No changes' });

  const sql = `UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);

  const [result] = await db.execute(sql, params);
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });

  res.json({ message: 'OK', id });
});

// HARD DELETE  (Secretary only)
router.delete('/:id', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    // σβήσε τυχόν child rows ώστε να μη σκάνε foreign keys
    await db.execute(`DELETE FROM works WHERE appointment_id = ?`, [id]);
    const [r] = await db.execute(`DELETE FROM appointments WHERE id = ?`, [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('appointments DELETE', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ======================================================
   GET /:id  (το generic GET πάει μετά τα ειδικά)
   ====================================================== */
router.get('/:id', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const u = req.session.user;

  const sql = `SELECT a.*,
                  DATE_FORMAT(a.appt_date,'%Y-%m-%d') AS appt_date,
                  TIME_FORMAT(a.appt_time,'%H:%i:%s') AS appt_time,
                  CONCAT(IFNULL(c.first_name,''),' ',IFNULL(c.last_name,''))  AS customer_name,
                  CONCAT(IFNULL(m.first_name,''),' ',IFNULL(m.last_name,''))  AS mechanic_name,
                  CONCAT(IFNULL(v.brand,''),' ',IFNULL(v.model,''))          AS vehicle_model
               FROM appointments a
               LEFT JOIN users c ON c.id = a.customer_id
               LEFT JOIN users m ON m.id = a.mechanic_id
               LEFT JOIN vehicles v ON v.id = a.vehicle_id
               WHERE a.id = ?`;
  const [rows] = await db.execute(sql, [id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });

  const a = rows[0];
  const allowed = (u.role === 'secretary') || (u.id === a.customer_id) || (u.id === a.mechanic_id);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const time5 = String(a.appt_time || '').slice(0, 5);
  const item = { ...a, appt_time: time5, startsAt: `${a.appt_date}T${time5}` };
  return res.json(item);
});



/* ======================================================
   CREATE & CANCEL (μπορούν να είναι στο τέλος)
   ====================================================== */
router.post('/', isAuthenticated, hasRole('customer', 'secretary'), async (req, res) => {
  const u = req.session.user;
  let { customer_id, vehicle_id, appt_date, appt_time, reason, problem_desc } = req.body;
  if (u.role === 'customer') customer_id = u.id;

  const [h] = String(appt_time || '').split(':').map(Number);
  if (isNaN(h) || h < 8 || h > 14) {
    return res.status(400).json({ error: 'Ώρα 08:00–16:00 (διάρκεια 2h, τελευταίο ξεκίνημα 14:00)' });
  }
  if (reason === 'repair' && !problem_desc) {
    return res.status(400).json({ error: 'Απαιτείται περιγραφή προβλήματος' });
  }

  const mechanic_id = await findAvailableMechanic(db, appt_date, appt_time);
  if (!mechanic_id) return res.status(409).json({ error: 'Δεν υπάρχει διαθέσιμος μηχανικός' });

  const apptCode = 'APT' + Math.random().toString(36).slice(2, 6).toUpperCase();

  try {
    await db.execute(
      `INSERT INTO appointments (appt_code, customer_id, vehicle_id, mechanic_id, appt_date, appt_time, reason, problem_desc)
       VALUES (?,?,?,?,?,?,?,?)`,
      [apptCode, Number(customer_id), Number(vehicle_id), mechanic_id, appt_date, appt_time, reason, problem_desc || null]
    );
    res.json({ message: 'Δημιουργήθηκε', appt_code: apptCode, mechanic_id });
  } catch (e) {
    res.status(400).json({ error: 'Λανθασμένα πεδία' });
  }
});

router.post('/:id/cancel', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const [[a]] = await db.execute(`SELECT * FROM appointments WHERE id = ?`, [id]);
  if (!a) return res.status(404).json({ error: 'Not found' });

  const u = req.session.user;
  if (!(u.role === 'secretary' || u.id === a.customer_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (['IN_PROGRESS', 'COMPLETED', 'CANCELED'].includes(a.status)) {
    return res.status(400).json({ error: 'Δεν επιτρέπεται' });
  }

  await db.execute(`UPDATE appointments SET status = 'CANCELED' WHERE id = ?`, [id]);
  res.json({ message: 'Ακυρώθηκε' });
});

// GET works for appointment
router.get('/:id/works', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const u = req.session.user;

  const [[a]] = await db.execute(
    `SELECT id, customer_id, mechanic_id FROM appointments WHERE id=?`, [id]
  );
  if (!a) return res.status(404).json({ error: 'Not found' });

  const allowed = (u.role === 'secretary') || (u.id === a.customer_id) || (u.id === a.mechanic_id);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const [rows] = await db.execute(
    `SELECT id, description, materials, finished_at, cost
     FROM works WHERE appointment_id=?
     ORDER BY finished_at ASC, id ASC`, [id]
  );
  const total = rows.reduce((s, w) => s + Number(w.cost || 0), 0);
  res.json({ items: rows, total });
});

router.get('/:id',
  isAuthenticated,
  allowRoles('secretary', 'mechanic'),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);

    // φόρτωσε το ραντεβού με χρήσιμα join-αρισμένα πεδία
    const [[a]] = await db.execute(
      `SELECT a.*,
              CONCAT(cu.first_name,' ',cu.last_name)  AS customer_name,
              CONCAT(mu.first_name,' ',mu.last_name)  AS mechanic_name,
              v.brand, v.model
       FROM appointments a
       LEFT JOIN users cu ON cu.id=a.customer_id
       LEFT JOIN users mu ON mu.id=a.mechanic_id
       LEFT JOIN vehicles v ON v.id=a.vehicle_id
       WHERE a.id=?`,
      [id]
    );
    if (!a) return res.status(404).json({ error: 'Not found' });

    const [works] = await db.execute(
      `SELECT id, description, materials, cost, finished_at
         FROM appointment_works
        WHERE appointment_id=?
        ORDER BY id`,
      [id]
    );

    res.json({ appointment: a, works });
  })
);


module.exports = router;
