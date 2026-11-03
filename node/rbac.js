/* Practical 9 — Role-Based Authentication and Access Control (RBAC) in JavaScript.
   A small API (plain Node http + MySQL) that shows:
     AUTHENTICATION  -> POST /login checks email + password, returns a signed token
     AUTHORIZATION   -> every route checks the user's ROLE (and ownership) first
   Run:  node node/rbac.js      (needs mysql-1.js to have been run)
   Test: node node/rbac-test.js                                              */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { connectDb, verifyPassword } = require('./db');

const PORT = process.env.RBAC_PORT || 4000;
const SECRET = process.env.TOKEN_SECRET || 'change-me-in-real-projects';

/* ---------- 1. Roles and their permissions (the RBAC table) ---------- */
const PERMISSIONS = {
  customer: ['products:read', 'orders:own'],
  grower:   ['products:read', 'products:create', 'products:delete:own'],
  admin:    ['products:read', 'products:create', 'products:delete', 'orders:all', 'users:manage']
};
const can = (role, permission) => (PERMISSIONS[role] || []).includes(permission);

/* ---------- 2. Token (signed with HMAC, expires in 1 hour) ---------- */
function makeToken(user) {
  const body = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 3600e3 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function readToken(token) {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== good) return null;                                  // tampered token
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;                     // expired token
}

/* ---------- 3. Middleware-style checks ---------- */
// Authentication: who are you?  -> 401 if not logged in
function authenticate(req) {
  const header = req.headers.authorization || '';
  return readToken(header.replace('Bearer ', ''));
}
// Authorization: are you allowed?  -> 403 if the role lacks the permission
function authorize(user, permission) {
  return user && can(user.role, permission);
}

const send = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((ok) => {
  let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s ? JSON.parse(s) : {}));
});

/* ---------- 4. Routes ---------- */
async function handle(req, res, db) {
  const url = req.url.split('?')[0];

  // public route: the demo web page (GUI)
  if (req.method === 'GET' && (url === '/' || url === '/rbac.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'rbac.html')));
  }

  // public route: login (authentication)
  if (req.method === 'POST' && url === '/login') {
    const { email, password } = await readBody(req);
    const [[user]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !verifyPassword(password || '', user.password_hash)) return send(res, 401, { error: 'Wrong email or password' });
    return send(res, 200, { token: makeToken(user), role: user.role, name: user.name });
  }

  // everything below needs a valid token
  const user = authenticate(req);
  if (!user) return send(res, 401, { error: 'Please log in first' });
  const deny = (what) => send(res, 403, { error: `Role "${user.role}" is not allowed to ${what}` });

  // GET /products — all roles
  if (req.method === 'GET' && url === '/products') {
    if (!authorize(user, 'products:read')) return deny('view products');
    const [rows] = await db.query('SELECT id, name, category, price FROM products LIMIT 5');
    return send(res, 200, rows);
  }

  // POST /products — grower, admin   (the new product then shows up on the website)
  if (req.method === 'POST' && url === '/products') {
    if (!authorize(user, 'products:create')) return deny('add products');
    const p = await readBody(req);
    if (!p.name || !p.category || !(Number(p.price) > 0)) return send(res, 400, { error: 'Name, category and a price above 0 are required' });

    // automatic id: p29, p30, ... (the highest "p<number>" id plus one)
    const [[last]] = await db.query("SELECT MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)) AS n FROM products WHERE id REGEXP '^p[0-9]+$'");
    const id = p.id || 'p' + ((last.n || 0) + 1);
    const [[me]] = await db.query('SELECT name FROM users WHERE id = ?', [user.id]);

    await db.query(
      `INSERT INTO products (id, name, category, price, unit, rating, organic, grower_id,
                             stock, farm, description, wiki, tags)
       VALUES (?, ?, ?, ?, ?, 4.5, ?, ?, ?, ?, ?, ?, ?)`,
      [id, p.name, p.category, p.price, p.unit || '1 pc', !!p.organic, user.id,
       Number.isInteger(p.stock) ? p.stock : 20, p.farm || me.name,
       p.description || 'Fresh from the farm.', JSON.stringify([p.name]), JSON.stringify([])]);
    return send(res, 201, { message: 'Product added — it is now on the website', id });
  }

  // DELETE /products/:id — admin (any) or grower (only their own)
  const del = url.match(/^\/products\/(\w+)$/);
  if (req.method === 'DELETE' && del) {
    const [[product]] = await db.query('SELECT grower_id FROM products WHERE id = ?', [del[1]]);
    if (!product) return send(res, 404, { error: 'No such product' });
    const allowed = authorize(user, 'products:delete') ||
      (authorize(user, 'products:delete:own') && product.grower_id === user.id);   // ownership check
    if (!allowed) return deny('delete this product');
    try {
      await db.query('DELETE FROM products WHERE id = ?', [del[1]]);
    } catch (e) {
      if (e.code === 'ER_ROW_IS_REFERENCED_2') return send(res, 409, { error: 'This product is in an order, so it cannot be deleted' });
      throw e;
    }
    return send(res, 200, { message: 'Product deleted — it is gone from the website' });
  }

  // GET /orders — customer sees own orders, admin sees all, grower is denied
  if (req.method === 'GET' && url === '/orders') {
    if (authorize(user, 'orders:all')) {
      const [rows] = await db.query('SELECT id, user_id, product_id, total, status FROM orders');
      return send(res, 200, rows);
    }
    if (authorize(user, 'orders:own')) {
      const [rows] = await db.query('SELECT id, product_id, total, status FROM orders WHERE user_id = ?', [user.id]);
      return send(res, 200, rows);
    }
    return deny('view orders');
  }

  // GET /users — admin only
  if (req.method === 'GET' && url === '/users') {
    if (!authorize(user, 'users:manage')) return deny('view users');
    const [rows] = await db.query('SELECT id, name, email, role FROM users');
    return send(res, 200, rows);
  }

  send(res, 404, { error: 'Not found' });
}

async function main() {
  const db = await connectDb();
  http.createServer((req, res) => {
    handle(req, res, db).catch((e) => send(res, 500, { error: e.message }));
  }).listen(PORT, () => console.log(`RBAC demo running — open http://localhost:${PORT} in your browser`));
}

if (require.main === module) main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
module.exports = { PERMISSIONS, can, makeToken, readToken };
