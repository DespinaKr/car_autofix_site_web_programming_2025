
<!-- PROJECT HEADER -->
<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-43853D" alt="Node 18+">
  <img src="https://img.shields.io/badge/Express.js-4.x-black" alt="Express 4">
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1" alt="MySQL 8">
  <img src="https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-ffcc00" alt="Frontend HTML/CSS/JS">
  <img src="https://img.shields.io/badge/Status-Active-success" alt="Status">
</p>

<h1 align="center">AutoFix – Automotive Workshop Management</h1>

<p align="center">
  <em>Web Programming 2025 • 3-tier app: Static UI + AJAX, REST API (Express), MySQL</em><br/>
  <sub>Roles: <strong>Secretary</strong> • <strong>Mechanic</strong> • <strong>Customer</strong></sub>
</p>

<hr/>

<!-- SUMMARY / PITCH -->
<h2>📝 Overview</h2>
<p>
<strong>AutoFix</strong> is an educational web application for managing an automotive workshop. It supports user registration/activation, vehicle management,
appointment scheduling with a <strong>2-hour slot rule (08:00–16:00)</strong> and automatic assignment of an available mechanic (no overlaps), status flow
(<code>CREATED → IN_PROGRESS → COMPLETED</code>, <code>CANCELED</code>), work items/materials per appointment, and automatic cost calculation.
</p>

<!-- TABLE OF CONTENTS -->
<h2>📚 Table of Contents</h2>
<ul>
  <li><a href="#features">Features</a></li>
  <li><a href="#tech">Tech Stack</a></li>
  <li><a href="#arch">Architecture</a></li>
  <li><a href="#structure">Project Structure</a></li>
  <li><a href="#setup">Setup & Run</a></li>
  <li><a href="#env">Environment Variables</a></li>
  <li><a href="#api">API Overview</a></li>
  <li><a href="#db">Database Schema</a></li>
  <li><a href="#security">Security & Best Practices</a></li>
  <li><a href="#roadmap">Roadmap</a></li>
  <li><a href="#license">License</a></li>
</ul>

<!-- FEATURES -->
<h2 id="features">✨ Features</h2>
<ul>
  <li><strong>Roles & RBAC</strong>: secretary, mechanic, customer with server-side guards.</li>
  <li><strong>Users</strong>: search (username/last name/AFM), activation by secretary, password change, deletion, <em>CSV import of customers</em> (inserted/skipped).</li>
  <li><strong>Vehicles</strong>: full CRUD, unique <code>serial_no</code>.</li>
  <li><strong>Appointments</strong>: 2-hour slots within 08:00–16:00, automatic assignment of an available mechanic without overlaps; reschedule only in <code>CREATED</code>; cancel with rules.</li>
  <li><strong>Work Items & Cost</strong>: add works/materials in <code>IN_PROGRESS</code>; automatic update of <code>total_cost</code>.</li>
  <li><strong>Pagination</strong>: server-side <code>LIMIT/OFFSET</code> + client-side controls.</li>
  <li><strong>Clean UI</strong>: Custom HTML/CSS/JS (no Bootstrap), common navbar with logout.</li>
</ul>

<!-- TECH -->
<h2 id="tech">🧰 Tech Stack</h2>
<ul>
  <li><strong>Backend</strong>: Node.js (Express), <code>helmet</code>, sessions (MySQL store), <code>mysql2/promise</code> (prepared statements)</li>
  <li><strong>Database</strong>: MySQL 8.x</li>
  <li><strong>Frontend</strong>: HTML, CSS, Vanilla JS (AJAX via <code>fetch</code>)</li>
</ul>

<!-- ARCHITECTURE -->
<h2 id="arch">🏗️ Architecture</h2>
<p>3-tier: <em>Static UI</em> (public) ↔ <em>REST API</em> (Express Routers) ↔ <em>DB</em> (MySQL).</p>
<ul>
  <li>Guards: <code>isAuthenticated</code>, <code>hasRole(...)</code>, <code>dashboardGuard</code> (role-based access to dashboards)</li>
  <li>Scheduling: <code>src/utils/scheduling.js</code> (2-hour overlap check & random pick among available mechanics)</li>
</ul>

<!-- STRUCTURE -->
<h2 id="structure">📁 Project Structure</h2>

<pre>
public/
  css/ (style.css, dash.css, users-table.css, vehicles-cards.css, appointments.css)
  js/
    api.js            (AJAX wrapper)
    auth-guard.js     (session check + logout delegation)
    nav-user.js       (navbar user badge)
    secretary.js      (KPIs)
    secretary.users.js
    secretary.vehicles.js
    secretary.appointments.js
    customer.js
    mechanic.js
    appointment.view.js
  dashboard/
    secretary.html
    users.html
    vehicles.html
    appointments.html
    customer.html
    mechanic.html

src/
  routes/
    auth.routes.js
    users.routes.js
    vehicles.routes.js
    appointments.routes.js
    uploads.routes.js
  middleware/
    auth.js           (isAuthenticated, hasRole)
  utils/
    scheduling.js     (findAvailableMechanic)
  db.js
server.js
sql/
  schema.sql
</pre>

<!-- SETUP -->
<h2 id="setup">⚙️ Setup & Run</h2>

<ol>
  <li><strong>Prerequisites</strong>: Node.js 18+, MySQL 8+</li>
  <li><strong>Install dependencies</strong>:
    <pre><code>npm install</code></pre>
  </li>
  <li><strong>Database</strong>:
    <pre><code>mysql -u root -p &lt; sql/schema.sql</code></pre>
  </li>
  <li><strong>Create <code>.env</code></strong> (see below)</li>
  <li><strong>Start</strong>:
    <ul>
      <li>Development: <code>npm run dev</code> (nodemon)</li>
      <li>Production: <code>npm start</code></li>
    </ul>
  </li>
</ol>

<!-- ENV -->
<h2 id="env">🔧 Environment Variables</h2>

<pre>
# .env
PORT=3000
SESSION_SECRET=change_me
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=autofix
</pre>

<!-- API -->
<h2 id="api">🔗 API Overview</h2>

<h3>Auth (<code>/api/auth</code>)</h3>
<ul>
  <li><code>POST /register</code>, <code>POST /login</code>, <code>POST /logout</code>, <code>GET /me</code></li>
</ul>

<h3>Users (<code>/api/users</code>)</h3>
<ul>
  <li><code>GET /</code> (search &amp; pagination), <code>GET /count</code></li>
  <li><code>GET|PATCH /me</code>, <code>PATCH /:id</code>, <code>PATCH /:id/activate</code>, <code>PATCH /:id/password</code></li>
  <li><code>DELETE /:id</code></li>
</ul>

<h3>Vehicles (<code>/api/vehicles</code>)</h3>
<ul>
  <li><code>GET /</code> (filters + pagination)</li>
  <li><code>POST /</code>, <code>PUT /:id</code>, <code>DELETE /:id</code></li>
</ul>

<h3>Appointments (<code>/api/appointments</code>)</h3>
<ul>
  <li><code>GET /</code>, <code>GET /count</code>, <code>GET /today/count</code></li>
  <li><code>POST /</code> (2-hour rule 08:00–16:00, auto-assign mechanic)</li>
  <li><code>GET /:id</code>, <code>GET /:id/works</code></li>
  <li><code>PATCH /:id/status</code>, <code>PATCH /:id/reschedule</code> (only when <code>CREATED</code>)</li>
  <li><code>POST /:id/works</code> (in <code>IN_PROGRESS</code>), <code>POST /:id/cancel</code></li>
</ul>

<h3>Uploads (<code>/api/uploads</code>)</h3>
<ul>
  <li><code>POST /users-csv</code> (CSV import for customers: inserted/skipped)</li>
</ul>

<!-- DB -->
<h2 id="db">🗄️ Database Schema (summary)</h2>

<table>
  <thead><tr><th>Table</th><th>Main Fields</th><th>Notes</th></tr></thead>
  <tbody>
    <tr>
      <td><code>users</code></td>
      <td><code>id</code>, <code>role</code>, <code>username</code> (UNIQUE), <code>email</code> (UNIQUE), <code>id_card</code> (UNIQUE), <code>is_active</code></td>
      <td>1-1 with <code>customers</code> or <code>mechanics</code></td>
    </tr>
    <tr>
      <td><code>vehicles</code></td>
      <td><code>id</code>, <code>owner_id</code> → users, <code>serial_no</code> (UNIQUE), brand/model</td>
      <td>ON DELETE CASCADE from owner</td>
    </tr>
    <tr>
      <td><code>appointments</code></td>
      <td><code>id</code>, <code>appt_code</code> (UNIQUE), <code>customer_id</code>, <code>vehicle_id</code>, <code>mechanic_id</code>, <code>appt_date</code>, <code>appt_time</code>, <code>status</code>, <code>total_cost</code></td>
      <td>Delete mechanic ⇒ <code>mechanic_id = NULL</code> (history preserved)</td>
    </tr>
    <tr>
      <td><code>works</code></td>
      <td><code>id</code>, <code>appointment_id</code>, <code>description</code>, <code>materials</code>, <code>cost</code>, <code>finished_at</code></td>
      <td>Total cost → <code>appointments.total_cost</code></td>
    </tr>
  </tbody>
</table>

<!-- SECURITY -->
<h2 id="security">🔒 Security & Best Practices</h2>
<ul>
  <li><strong>Helmet</strong> for secure HTTP headers.</li>
  <li><strong>Sessions</strong> in a MySQL store; cookies: <code>httpOnly</code>, <code>sameSite:lax</code>, <code>secure</code> (prod).</li>
  <li><strong>Prepared statements</strong> (anti-SQLi) everywhere.</li>
  <li><strong>XSS hygiene</strong>: use <code>textContent</code> in the UI; avoid raw HTML injection.</li>
  <li><strong>RBAC</strong>: <code>isAuthenticated</code>, <code>hasRole</code>, server-side guards for dashboards.</li>
</ul>

<!-- ROADMAP -->
<h2 id="roadmap">🗺️ Roadmap</h2>
<ul>
  <li>[ ] CSV import for vehicles</li>
  <li>[ ] Export customer history (PDF/CSV)</li>
  <li>[ ] i18n toggle (EL/EN)</li>
</ul>

<!-- LICENSE -->
<h2 id="license">📄 License</h2>
<p>Academic/educational project. Pick a license (e.g., MIT) that suits your repository.</p>

<hr/>

<p align="center">
  Made with ❤️. If you find this useful, consider giving the repo a ⭐.
</p>
"""
