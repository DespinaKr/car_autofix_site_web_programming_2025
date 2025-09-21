const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { findAvailableMechanic } = require('../utils/scheduling');

function canView(u, appt){ 
  return u.role==='secretary' || u.id===appt.customer_id || u.id===appt.mechanic_id; 
}

// Helper για «σήμερα» στην Australia/Perth ώστε να ταιριάζει με την εκφώνηση/ωράριο
function todayPerth() {
  // en-CA => YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' });
}

// List / search
router.get('/', isAuthenticated, async (req, res) => {
  const u = req.session.user;
  const { from, to, status, query } = req.query;
  let sql = `SELECT a.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name,
                    CONCAT(m.first_name,' ',m.last_name) AS mechanic_name,
                    v.model, v.brand
             FROM appointments a
             JOIN users c ON c.id=a.customer_id
             LEFT JOIN users m ON m.id=a.mechanic_id
             JOIN vehicles v ON v.id=a.vehicle_id
             WHERE 1=1`;
  const params = [];
  if (from) { sql += ` AND a.appt_date >= ?`; params.push(from); }
  if (to)   { sql += ` AND a.appt_date <= ?`; params.push(to); }
  if (status) { sql += ` AND a.status = ?`; params.push(status); }
  if (query) { sql += ` AND (c.last_name LIKE ? OR c.id IN (SELECT user_id FROM customers WHERE afm LIKE ?))`; params.push(`%${query}%`,`%${query}%`); }

  if (u.role==='customer') { sql += ` AND a.customer_id=?`; params.push(u.id); }
  if (u.role==='mechanic') { sql += ` AND a.mechanic_id=?`; params.push(u.id); }
  if (!from && !to && !status && !query) {
  const today = todayPerth(); // αντί για new Date().toISOString().slice(0,10)
  sql += ` AND a.appt_date = ? AND a.status = 'CREATED'`;
  params.push(today);
  sql += ` ORDER BY a.appt_date DESC, a.appt_time DESC LIMIT 50`;
  }
  const [items] = await db.execute(sql, params);
  res.json({ items });
});

// Create
router.post('/', isAuthenticated, hasRole('customer','secretary'), async (req, res) => {
  const u = req.session.user;
  let { customer_id, vehicle_id, appt_date, appt_time, reason, problem_desc } = req.body;
  if (u.role==='customer') customer_id = u.id;

  const [h,m] = String(appt_time||'').split(':').map(Number);

if (isNaN(h) || h < 8 || h > 14) {
  return res.status(400).json({ error: 'Ώρα 08:00–16:00 (διάρκεια 2h, τελευταίο ξεκίνημα 14:00)' });
}

  if (reason === 'repair' && !problem_desc) return res.status(400).json({ error: 'Απαιτείται περιγραφή προβλήματος' });

  const mechanic_id = await findAvailableMechanic(db, appt_date, appt_time);
  if (!mechanic_id) return res.status(409).json({ error: 'Δεν υπάρχει διαθέσιμος μηχανικός' });

  const apptCode = 'APT' + Math.random().toString(36).slice(2,6).toUpperCase();
  try{
    await db.execute(
      `INSERT INTO appointments (appt_code, customer_id, vehicle_id, mechanic_id, appt_date, appt_time, reason, problem_desc)
       VALUES (?,?,?,?,?,?,?,?)`,
      [apptCode, Number(customer_id), Number(vehicle_id), mechanic_id, appt_date, appt_time, reason, problem_desc||null]
    );
    res.json({ message:'Δημιουργήθηκε', appt_code: apptCode, mechanic_id });
  }catch(e){
    res.status(400).json({ error:'Λανθασμένα πεδία' });
  }
});

// Update date/time (only when CREATED). Customer or Secretary.
router.patch('/:id/reschedule', isAuthenticated, hasRole('customer','secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { appt_date, appt_time } = req.body;

  const [[a]] = await db.execute(`SELECT * FROM appointments WHERE id=?`, [id]);
  if (!a) return res.status(404).json({ error:'Not found' });
  if (req.session.user.role==='customer' && req.session.user.id !== a.customer_id)
    return res.status(403).json({ error:'Forbidden' });
  if (a.status !== 'CREATED') return res.status(400).json({ error:'Only when status=CREATED' });

 const [h,m] = String(appt_time||'').split(':').map(Number);
if (isNaN(h) || h < 8 || h > 14) {
  return res.status(400).json({ error: 'Ώρα 08:00–16:00 (διάρκεια 2h, τελευταίο ξεκίνημα 14:00)' });
}
  const mech = await findAvailableMechanic(db, appt_date, appt_time);
  if (!mech) return res.status(409).json({ error:'Δεν υπάρχει διαθέσιμος μηχανικός' });

  await db.execute(`UPDATE appointments SET appt_date=?, appt_time=?, mechanic_id=? WHERE id=?`,
                   [appt_date, appt_time, mech, id]);
  res.json({ message:'Ανανεώθηκε' });
});

// Change status (Secretary only, cancel separate)
router.patch('/:id/status', isAuthenticated, hasRole('secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['CREATED','IN_PROGRESS','COMPLETED'].includes(status)) return res.status(400).json({ error:'Invalid status' });
  await db.execute(`UPDATE appointments SET status=? WHERE id=?`, [status, id]);
  res.json({ message:'OK' });
});

// Cancel (anyone except when IN_PROGRESS/COMPLETED/CANCELED)
router.post('/:id/cancel', isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const [[a]] = await db.execute(`SELECT * FROM appointments WHERE id=?`, [id]);
  if (!a) return res.status(404).json({ error:'Not found' });
  const u = req.session.user;
  if (!(u.role==='secretary' || u.id===a.customer_id)) return res.status(403).json({ error:'Forbidden' });
  if (['IN_PROGRESS','COMPLETED','CANCELED'].includes(a.status)) return res.status(400).json({ error:'Δεν επιτρέπεται' });
  await db.execute(`UPDATE appointments SET status='CANCELED' WHERE id=?`, [id]);
  res.json({ message:'Ακυρώθηκε' });
});

// Works (only when IN_PROGRESS) – simple add work
router.post('/:id/works', isAuthenticated, hasRole('mechanic','secretary'), async (req, res) => {
  const id = Number(req.params.id);
  const { description, materials, finished_at, cost } = req.body;
  const [[a]] = await db.execute(`SELECT * FROM appointments WHERE id=?`, [id]);
  if (!a) return res.status(404).json({ error:'Not found' });
  if (req.session.user.role==='mechanic' && req.session.user.id !== a.mechanic_id) return res.status(403).json({ error:'Forbidden' });
  if (a.status!=='IN_PROGRESS') return res.status(400).json({ error:'Μόνο όταν είναι IN_PROGRESS' });

  await db.execute(`INSERT INTO works (appointment_id, description, materials, finished_at, cost) VALUES (?,?,?,?,?)`,
                   [id, description, materials, finished_at, Number(cost)]);
  await db.execute(`UPDATE appointments SET total_cost = (SELECT COALESCE(SUM(cost),0) FROM works WHERE appointment_id=?) WHERE id=?`,
                   [id, id]);
  res.json({ message:'Καταχωρήθηκε εργασία' });
});

// Συνολικός αριθμός ραντεβού (προαιρετικά: ?status=CREATED|IN_PROGRESS|COMPLETED|CANCELED)
router.get('/count', isAuthenticated, hasRole('secretary'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT COUNT(*) AS c FROM appointments';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    const [[{ c }]] = await db.execute(sql, params);
    res.json({ count: c });
  } catch (err) {
    console.error('appointments/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Ραντεβού της ΣΗΜΕΡΙΝΗΣ ημέρας (Perth) που εκκρεμούν by default
// Προαιρετικά: ?status=... (αν δεν δοθεί => CREATED)
router.get('/today/count', isAuthenticated, hasRole('secretary'), async (req, res) => {
  try {
    const status = req.query.status || 'CREATED';
    const today = todayPerth();
    const [[{ c }]] = await db.execute(
      'SELECT COUNT(*) AS c FROM appointments WHERE appt_date = ? AND status = ?',
      [today, status]
    );
    res.json({ count: c, date: today, status });
  } catch (err) {
    console.error('appointments/today/count', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
