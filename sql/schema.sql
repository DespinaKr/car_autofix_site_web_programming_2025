CREATE DATABASE IF NOT EXISTS autofix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE autofix;

DROP TABLE IF EXISTS works;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS mechanics;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('customer','secretary','mechanic') NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  id_card VARCHAR(30) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE customers (
  user_id INT PRIMARY KEY,
  afm VARCHAR(15) NOT NULL,
  address VARCHAR(255) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mechanics (
  user_id INT PRIMARY KEY,
  specialty VARCHAR(100) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  serial_no VARCHAR(64) NOT NULL UNIQUE,
  model VARCHAR(80) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  car_type ENUM('passenger','truck','bus') NOT NULL,
  engine_type ENUM('electric','diesel','lpg','hybrid') NOT NULL,
  doors INT NOT NULL,
  wheels INT NOT NULL,
  production_date DATE NOT NULL,
  acquisition_year INT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appt_code VARCHAR(16) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  mechanic_id INT,
  appt_date DATE NOT NULL,
  appt_time TIME NOT NULL,
  reason ENUM('repair','service') NOT NULL,
  problem_desc TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('CREATED','IN_PROGRESS','COMPLETED','CANCELED') NOT NULL DEFAULT 'CREATED',
  total_cost DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (mechanic_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE works (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  materials VARCHAR(255) NOT NULL,
  finished_at DATETIME NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Demo data similar to screenshots
INSERT INTO users (role, username, email, password_hash, first_name, last_name, id_card, is_active)
VALUES
('secretary','admin','admin@garage.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Admin','Secretary','ID0001',1),
('customer','john','customer@example.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','John','Doe','ID123456',1),
('mechanic','mike','mechanic@garage.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Mike','Smith','ID987654',1),
('customer','maria','maria@example.com','$2a$10$2ZsXk8m87wD7O6z7s2g8le8Cqx6Kz9xJ6x8RAV5oU12QY8oY2gThS','Maria','Papadopoulos','ID555111',1);

INSERT INTO customers (user_id, afm, address) VALUES
((SELECT id FROM users WHERE username='john'),'123456789','Athens'),
((SELECT id FROM users WHERE username='maria'),'987654321','Athens');

INSERT INTO mechanics (user_id, specialty) VALUES
((SELECT id FROM users WHERE username='mike'),'Engine Specialist');

INSERT INTO vehicles (owner_id, serial_no, model, brand, car_type, engine_type, doors, wheels, production_date, acquisition_year) VALUES
((SELECT id FROM users WHERE username='john'),'TOY123456789','Corolla','Toyota','passenger','hybrid',4,4,'2021-06-01',2021),
((SELECT id FROM users WHERE username='maria'),'BMW987654321','X3','BMW','passenger','diesel',4,4,'2020-03-01',2020),
((SELECT id FROM users WHERE username='john'),'MER456789123','Sprinter','Mercedes','truck','diesel',2,6,'2019-01-01',2019);

INSERT INTO appointments (appt_code, customer_id, vehicle_id, mechanic_id, appt_date, appt_time, reason, problem_desc, status, total_cost) VALUES
('APT001', (SELECT id FROM users WHERE username='john'), (SELECT id FROM vehicles WHERE serial_no='TOY123456789'), (SELECT id FROM users WHERE username='mike'),'2024-01-20','10:00','service',NULL,'CREATED',150),
('APT002', (SELECT id FROM users WHERE username='maria'), (SELECT id FROM vehicles WHERE serial_no='BMW987654321'), (SELECT id FROM users WHERE username='mike'),'2024-01-20','11:30','repair','Engine making strange noise','IN_PROGRESS',350),
('APT003', (SELECT id FROM users WHERE username='john'), (SELECT id FROM vehicles WHERE serial_no='MER456789123'), (SELECT id FROM users WHERE username='mike'),'2024-01-21','14:00','service',NULL,'COMPLETED',200);
