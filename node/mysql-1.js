/* Practical I — Node.js + MySQL:
   create a database, create tables, insert records, update a record.
   Run:  node node/mysql-1.js                                             */

const fs = require('fs');
const path = require('path');
const { DB_NAME, connectServer, connectDb, hashPassword } = require('./db');

async function main() {
  // 1. CREATE DATABASE
  let con = await connectServer();
  await con.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  console.log(`1. Database "${DB_NAME}" is ready`);
  await con.end();

  con = await connectDb();

  // 2. CREATE TABLE  (3 tables: users -> products -> orders)
  await con.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(200) NOT NULL,
      role          ENUM('customer','grower','admin') NOT NULL DEFAULT 'customer',
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  await con.query(`
    CREATE TABLE IF NOT EXISTS products (
      id        VARCHAR(10) PRIMARY KEY,
      name      VARCHAR(100) NOT NULL,
      category  VARCHAR(50)  NOT NULL,
      price     DECIMAL(8,2) NOT NULL,
      unit      VARCHAR(30),
      rating    DECIMAL(2,1),
      organic   BOOLEAN DEFAULT FALSE,
      grower_id INT,
      FOREIGN KEY (grower_id) REFERENCES users(id)
    )`);
  // Extra columns so the website can be built from this table (Option A).
  // Added one by one only if missing, so it also upgrades a table made by an older copy of this script.
  const extra = {
    emoji: "VARCHAR(10)", image: "VARCHAR(300) DEFAULT ''", wiki: 'TEXT',
    stock: 'INT DEFAULT 20', featured: 'BOOLEAN DEFAULT FALSE', farm: 'VARCHAR(120)',
    description: 'TEXT', tags: 'TEXT', nutrition: 'TEXT'
  };
  const [have] = await con.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'", [DB_NAME]);
  const haveCols = have.map((c) => c.COLUMN_NAME.toLowerCase());
  for (const [col, type] of Object.entries(extra)) {
    if (!haveCols.includes(col)) await con.query(`ALTER TABLE products ADD COLUMN ${col} ${type}`);
  }

  await con.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      product_id VARCHAR(10) NOT NULL,
      quantity   INT NOT NULL DEFAULT 1,
      total      DECIMAL(10,2) NOT NULL,
      status     ENUM('placed','shipped','delivered','cancelled') DEFAULT 'placed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)    REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);
  console.log('2. Tables ready: users, products, orders');

  // 3. INSERT — users (same demo accounts as signin.html, plus an admin)
  const users = [
    ['Alex Morgan',             'user@freshcart.com',   'password123',  'customer'],
    ['Sun Valley Organic Farm', 'farmer@freshcart.com', 'growerpass123','grower'],
    ['Store Admin',             'admin@freshcart.com',  'admin123',     'admin']
  ];
  for (const [name, email, pass, role] of users) {
    await con.query(
      'INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashPassword(pass), role]);
  }
  console.log('3a. Inserted users');

  // 3b. INSERT — products, read from the project's data/products.json
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
  const [[grower]] = await con.query("SELECT id FROM users WHERE email = 'farmer@freshcart.com'");
  for (const p of data.products) {
    await con.query(
      `INSERT INTO products (id, name, category, price, unit, rating, organic, grower_id,
                             emoji, image, wiki, stock, featured, farm, description, tags, nutrition)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), price=VALUES(price),
         unit=VALUES(unit), rating=VALUES(rating), organic=VALUES(organic), emoji=VALUES(emoji),
         image=VALUES(image), wiki=VALUES(wiki), stock=VALUES(stock), featured=VALUES(featured),
         farm=VALUES(farm), description=VALUES(description), tags=VALUES(tags), nutrition=VALUES(nutrition)`,
      [p.id, p.name, p.category, p.price, p.unit, p.rating, !!p.organic, grower.id,
       p.emoji, p.image || '', JSON.stringify(p.wiki || []), p.stock, !!p.featured, p.farm,
       p.description, JSON.stringify(p.tags || []), JSON.stringify(p.nutrition || null)]);
  }
  console.log(`3b. Saved ${data.products.length} products (all website fields)`);

  // 3c. INSERT — one order
  const [[customer]] = await con.query("SELECT id FROM users WHERE email = 'user@freshcart.com'");
  const [[first]] = await con.query('SELECT id, price FROM products ORDER BY id LIMIT 1');
  await con.query(
    'INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)',
    [customer.id, first.id, 2, first.price * 2]);
  console.log('3c. Inserted 1 order');

  // 4. UPDATE a record
  const [[before]] = await con.query('SELECT name, price FROM products WHERE id = ?', [first.id]);
  const [res] = await con.query('UPDATE products SET price = price + 5 WHERE id = ?', [first.id]);
  const [[after]] = await con.query('SELECT name, price FROM products WHERE id = ?', [first.id]);
  console.log(`4. Updated ${res.affectedRows} record: ${before.name} price ${before.price} -> ${after.price}`);

  await con.query("UPDATE orders SET status = 'shipped' WHERE user_id = ? ORDER BY id DESC LIMIT 1", [customer.id]);
  console.log('   Updated latest order status to "shipped"');

  await con.end();
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
