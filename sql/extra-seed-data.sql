-- =========================
-- Επιπλέον seed δεδομένα
-- =========================

-- ---- Νέοι χρήστες ----
INSERT INTO users (role, username, email, password_hash, first_name, last_name, id_card, is_active) VALUES
('secretary','stella','stella@garage.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Stella','Argyri','ID0002',1),
('customer','nikos','nikos@example.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Nikos','Kostas','ID222333',1),
('customer','eleni','eleni@example.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Eleni','Karagianni','ID222334',1),
('customer','george','george@example.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','George','Papas','ID222335',1),
('customer','sofia','sofia@example.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Sofia','Nikolaou','ID222336',1),
('mechanic','nick','nick@garage.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Nikos','Vasileiou','ID333777',1),
('mechanic','alex','alex@garage.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Alexandros','Ioannou','ID333778',1);

-- ---- Customers / Mechanics προφίλ ----
INSERT INTO customers (user_id, afm, address) VALUES
((SELECT id FROM users WHERE username='nikos'),'111222333','Thessaloniki'),
((SELECT id FROM users WHERE username='eleni'),'444555666','Patra'),
((SELECT id FROM users WHERE username='george'),'777888999','Heraklion'),
((SELECT id FROM users WHERE username='sofia'),'123123123','Volos');

INSERT INTO mechanics (user_id, specialty) VALUES
((SELECT id FROM users WHERE username='nick'),'Transmission Specialist'),
((SELECT id FROM users WHERE username='alex'),'Diagnostics & Electronics');

-- ---- Οχήματα ----
INSERT INTO vehicles (owner_id, serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year) VALUES
((SELECT id FROM users WHERE username='nikos'),'HND1122334455','i20','Hyundai','passenger','lpg',4,4,'2018-05-15',2018),
((SELECT id FROM users WHERE username='nikos'),'RNL5566778899','Master','Renault','truck','diesel',2,6,'2017-09-09',2017),

((SELECT id FROM users WHERE username='eleni'),'TES123ABC999','Model 3','Tesla','passenger','electric',4,4,'2022-03-10',2022),

((SELECT id FROM users WHERE username='george'),'MANBUS2020','Lion''s City','MAN','bus','diesel',2,6,'2020-02-01',2020),

((SELECT id FROM users WHERE username='sofia'),'TOYCH-R2021','C-HR','Toyota','passenger','hybrid',4,4,'2021-07-20',2021);

-- ---- Ραντεβού ----
INSERT INTO appointments (appt_code, customer_id, vehicle_id, mechanic_id, appt_date, appt_time, reason, problem_desc, status, total_cost) VALUES
('APT004',
  (SELECT id FROM users WHERE username='nikos'),
  (SELECT id FROM vehicles WHERE serial_no='HND1122334455'),
  (SELECT id FROM users WHERE username='nick'),
  '2024-02-01','09:00','service',NULL,'CREATED',0),

('APT005',
  (SELECT id FROM users WHERE username='eleni'),
  (SELECT id FROM vehicles WHERE serial_no='TES123ABC999'),
  (SELECT id FROM users WHERE username='alex'),
  '2024-02-01','12:00','repair','Battery warning indicator','IN_PROGRESS',120),

('APT006',
  (SELECT id FROM users WHERE username='george'),
  (SELECT id FROM vehicles WHERE serial_no='MANBUS2020'),
  (SELECT id FROM users WHERE username='mike'),
  '2024-02-02','08:30','service',NULL,'CANCELED',0),

('APT007',
  (SELECT id FROM users WHERE username='sofia'),
  (SELECT id FROM vehicles WHERE serial_no='TOYCH-R2021'),
  (SELECT id FROM users WHERE username='nick'),
  '2024-02-03','10:45','repair','A/C not cooling well','CREATED',0),

('APT008',
  (SELECT id FROM users WHERE username='john'),
  (SELECT id FROM vehicles WHERE serial_no='MER456789123'),
  (SELECT id FROM users WHERE username='mike'),
  '2024-02-04','14:15','service',NULL,'IN_PROGRESS',220),

('APT009',
  (SELECT id FROM users WHERE username='maria'),
  (SELECT id FROM vehicles WHERE serial_no='BMW987654321'),
  (SELECT id FROM users WHERE username='alex'),
  '2024-02-10','09:30','repair','Timing belt replacement','COMPLETED',500);

-- ---- Εργασίες (works) για ορισμένα ραντεβού ----
INSERT INTO works (appointment_id, description, materials, finished_at, cost) VALUES
((SELECT id FROM appointments WHERE appt_code='APT003'),'Oil change','Oil + filter','2024-01-21 15:00:00',120.00),
((SELECT id FROM appointments WHERE appt_code='APT003'),'Brake pads','Front pads','2024-01-21 16:10:00',80.00),

((SELECT id FROM appointments WHERE appt_code='APT004'),'General inspection','—','2024-02-01 10:00:00',50.00),

((SELECT id FROM appointments WHERE appt_code='APT005'),'Battery diagnostics','—','2024-02-01 13:30:00',100.00),
((SELECT id FROM appointments WHERE appt_code='APT005'),'High-voltage safety check','—','2024-02-01 14:10:00',20.00),

((SELECT id FROM appointments WHERE appt_code='APT008'),'Full service pack','Oil/filter/cabin filter','2024-02-04 16:00:00',220.00),

((SELECT id FROM appointments WHERE appt_code='APT009'),'Timing belt kit','Belt + tensioner','2024-02-10 13:00:00',350.00),
((SELECT id FROM appointments WHERE appt_code='APT009'),'Coolant flush','Coolant','2024-02-10 13:40:00',150.00);
