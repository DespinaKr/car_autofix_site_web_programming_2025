const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const db = require('../db');
const { isAuthenticated, hasRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/users-csv', isAuthenticated, hasRole('secretary'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error:'No file' });
  let inserted=0, skipped=0;
  await new Promise((resolve,reject) => {
    parse(req.file.buffer, { columns:true, trim:true, skip_empty_lines:true }, async (err, records) => {
      if (err) return reject(err);
      for (const r of records) {
        try{
          await db.execute(
            `INSERT INTO users (role, username, email, password_hash, first_name, last_name, id_card, is_active)
             VALUES ('customer', ?, ?, '$2a$10$abcdefghijklmnopqrstuv', ?, ?, ?, 0)`,
            [r.username, r.email, r.first_name, r.last_name, r.id_card]
          );
          inserted++;
        }catch(e){ skipped++; }
      }
      resolve();
    });
  });
  res.json({ message:'OK', inserted, skipped });
});

module.exports = router;
