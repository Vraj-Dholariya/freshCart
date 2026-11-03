/* ============================================================
   freshcart — server.js
   A tiny static web server built with Node's http module.
   Why you need it: the site loads data/products.json with fetch(),
   and browsers block fetch() on file:// pages. localhost is also
   treated as a "secure" origin, which the Geolocation API needs.

   Run:   node server.js
   Open:  http://localhost:3000
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

/* ---------- /api/catalog : the product list from MySQL (same shape as data/products.json) ----------
   The site calls this first. If MySQL (or mysql2) is not available it answers 503 and the site
   quietly falls back to data/products.json, so the website never breaks.                           */
const parseJson = (v, fallback) => {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v !== 'string') return v;              // MySQL JSON columns may already be parsed
  try { return JSON.parse(v); } catch (e) { return fallback; }
};

async function sendCatalog(res) {
  try {
    const { connectDb } = require('./node/db');     // loaded only when needed
    const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
    const icon = Object.fromEntries(base.categories.map((c) => [c.id, c.icon]));

    const con = await connectDb();
    const [rows] = await con.query(
      `SELECT p.*, u.name AS grower_name FROM products p
         LEFT JOIN users u ON u.id = p.grower_id ORDER BY LENGTH(p.id), p.id`);
    await con.end();

    const products = rows.map((r) => ({
      id: r.id, name: r.name, category: r.category,
      emoji: r.emoji || icon[r.category] || '🛒',
      image: r.image || '',
      wiki: parseJson(r.wiki, [r.name]),
      price: Number(r.price), unit: r.unit || '1 pc',
      rating: Number(r.rating) || 4.5,
      organic: !!r.organic,
      stock: r.stock === null ? 20 : r.stock,
      featured: !!r.featured,
      farm: r.farm || r.grower_name || 'freshcart',
      description: r.description || 'Fresh from the farm.',
      tags: parseJson(r.tags, []),
      nutrition: parseJson(r.nutrition, null)
    }));
    send(res, 200, JSON.stringify({ store: base.store, categories: base.categories, products }),
      'application/json; charset=utf-8');
  } catch (e) {
    send(res, 503, 'MySQL catalog not available: ' + e.message);
  }
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    return send(res, 400, 'Bad request');
  }

  if (urlPath === '/api/catalog') return sendCatalog(res);

  let file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));

  // never serve anything outside the project folder
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, 'index.html');

    fs.readFile(file, (readErr, data) => {
      if (readErr) return send(res, 404, '404 — not found: ' + urlPath);
      send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
  });
});

server.listen(PORT, () => {
  console.log(`freshcart is running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
