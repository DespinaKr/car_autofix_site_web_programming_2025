async function findAvailableMechanic(db, date, time) {
  // find mechanics active
  const [mechs] = await db.execute(`SELECT id FROM users WHERE role='mechanic' AND is_active=1`);
  if (!mechs.length) return null;

  // appointments blocking 2h
  const [busyRows] = await db.execute(
    `SELECT mechanic_id, appt_time FROM appointments 
     WHERE appt_date=? AND status IN ('CREATED','IN_PROGRESS') AND mechanic_id IS NOT NULL`, [date]);

  const start = toMinutes(time);
  const end = start + 120; // 2 hours
  const busy = new Map(); // mechanic_id -> list of [s,e)
  for (const r of busyRows) {
    const s = toMinutes(r.appt_time);
    const e = s + 120;
    if (!busy.has(r.mechanic_id)) busy.set(r.mechanic_id, []);
    busy.get(r.mechanic_id).push([s,e]);
  }

  const free = mechs.filter(m => {
    const slots = busy.get(m.id) || [];
    return slots.every(([s,e]) => e <= start || s >= end);
  });
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)].id;
}

function toMinutes(hhmm){
  const [h,m] = hhmm.split(':').map(Number);
  return h*60+m;
}

module.exports = { findAvailableMechanic };
