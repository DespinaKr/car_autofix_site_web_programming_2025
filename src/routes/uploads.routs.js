router.post('/vehicles-csv', isAuthenticated, hasRole('secretary'), upload.single('file'), async (req,res)=>{
  if (!req.file) return res.status(400).json({ error:'No file' });
  let inserted=0, skipped=0;
  await new Promise((resolve,reject)=>{
    parse(req.file.buffer, { columns:true, trim:true, skip_empty_lines:true }, async (err, rows)=>{
      if (err) return reject(err);
      for (const r of rows) {
        try {
          // Πεδία: owner_username, serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year
          const [[owner]] = await db.execute(`SELECT id FROM users WHERE username=? AND role='customer'`, [r.owner_username]);
          if (!owner) { skipped++; continue; }
          await db.execute(
            `INSERT INTO vehicles (owner_id, serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [owner.id, r.serial_no, r.model, r.brand, r.car_type, r.engine_type, Number(r.doors), Number(r.wheels), r.production_date, Number(r.acquisition_year)]
          );
          inserted++;
        } catch {
          skipped++;
        }
      }
      resolve();
    });
  });
  res.json({ message:'OK', inserted, skipped });
});
