# MySQL + RBAC practicals — setup and run guide

## 1. Install MySQL (once)
- **Windows / macOS:** download *MySQL Community Server* (or install XAMPP and start "MySQL")
  from https://dev.mysql.com/downloads/mysql/ and remember the **root password** you set.
- **Ubuntu:** `sudo apt install mysql-server && sudo systemctl start mysql`
- Check it works: `mysql -u root -p` (type your password; `exit` to leave).
  XAMPP's default is user `root` with an **empty** password.

## 2. Install the Node driver (once, in the freshcart folder)
```
npm install
```
(this installs `mysql2`, the only extra package)

## 3. Tell the project your MySQL login
Either edit `password:` in `node/db.js`, or set variables before running:

| Windows (PowerShell)            | macOS / Linux                  |
|---------------------------------|--------------------------------|
| `$env:DB_PASSWORD="yourpass"`   | `export DB_PASSWORD=yourpass`  |
| `$env:DB_USER="root"`           | `export DB_USER=root`          |

Optional: `DB_HOST` (default `localhost`), `DB_NAME` (default `freshcart_db`).

## 4. Run the practicals (from the freshcart folder)
| Practical | Command | What it does |
|---|---|---|
| I  | `node node/mysql-1.js` | create database, create 3 tables, insert records, update records |
| II | `node node/mysql-2.js` | select, select DISTINCT, JOIN, delete a record, drop table `orders` |
| 9  | `node node/rbac.js` (keep running) | starts the role-based API on port 4000 |
| 9  | open **http://localhost:4000** | GUI: log in as each role, press buttons, see allowed (200) vs blocked (401/403) |
| 9  | `node node/rbac-test.js` (2nd terminal) | same checks as a text report |

Run `mysql-1.js` again any time to bring back the dropped table and sample data.
Order: `mysql-1.js` -> `mysql-2.js` -> `mysql-1.js` -> `rbac.js` + `rbac-test.js`.

## 4b. Website connected to MySQL (products)
The website now reads its products from the MySQL `products` table, so an admin/grower adding a product really adds it to the site.

1. Run `node node/mysql-1.js` once (it also upgrades an older `products` table with the extra columns).
2. Terminal 1: `node server.js`  -> website at http://localhost:3000
3. Terminal 2: `node node/rbac.js` -> admin demo at http://localhost:4000
4. In the demo page log in as **admin** (or grower), fill the "Add this product" form, press the button.
5. Refresh http://localhost:3000/products.html — the new product is there (its page opens too). Delete it in the demo and it disappears.

Set `DB_PASSWORD` in **both** terminals (or save it in `node/db.js`).
If MySQL is not running, the site still works: it quietly falls back to `data/products.json`.
Note: re-running `mysql-1.js` resets the seed products to the values in `products.json` (and Carrots to 45 after its demo update).

## 5. Database design
```
users (id, name, email UNIQUE, password_hash, role, created_at)
   |  1 grower -> many products          1 customer -> many orders
products (id, name, category, price, unit, rating, organic, grower_id -> users.id)
   |  1 product -> many orders
orders (id, user_id -> users.id, product_id -> products.id, quantity, total, status, created_at)
```

## 6. Role-based access control (RBAC)
Demo logins (same as `signin.html`, plus an admin):

| Role | Email | Password |
|---|---|---|
| customer | user@freshcart.com | password123 |
| grower | farmer@freshcart.com | growerpass123 |
| admin | admin@freshcart.com | admin123 |

| Action (API route) | customer | grower | admin |
|---|---|---|---|
| View products `GET /products` | yes | yes | yes |
| View orders `GET /orders` | own only | no | all |
| Add product `POST /products` | no | yes | yes |
| Delete product `DELETE /products/:id` | no | own only | any |
| View users `GET /users` | no | no | yes |

How it works (see comments in `node/rbac.js`):
1. **Authentication** — `POST /login` checks the email and the hashed password in MySQL and returns a signed token holding the user's id and role.
2. **Authorization** — each route calls `authenticate()` (no/invalid token -> **401**) then `authorize(user, permission)` (role lacks permission -> **403**). Growers also get an ownership check on delete.
3. The role comes from the signed token, so the user cannot simply edit it in the browser — unlike the old `localStorage` role label.

## Troubleshooting
- `Access denied for user` -> wrong `DB_USER` / `DB_PASSWORD`.
- `ECONNREFUSED` -> MySQL isn't running; start the MySQL service (or XAMPP).
- `Cannot find module 'mysql2'` -> run `npm install` in the freshcart folder.
- `Unknown database` -> run `node node/mysql-1.js` first.
