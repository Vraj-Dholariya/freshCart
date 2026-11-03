/* Practical II — Node.js + MySQL:
   select records, select unique values, delete a record, drop a table.
   Run mysql-1.js first.   Run:  node node/mysql-2.js                      */

const { connectDb } = require('./db');

async function main() {
  const con = await connectDb();

  // 1. SELECT with WHERE + ORDER BY
  const [fruit] = await con.query(
    "SELECT id, name, price FROM products WHERE category = ? ORDER BY price DESC LIMIT 5", ['fruit']);
  console.log('1. SELECT — 5 most expensive fruit:');
  console.table(fruit);

  // 2. SELECT with JOIN (orders + users + products)
  const [orders] = await con.query(
    `SELECT o.id, u.name AS customer, p.name AS product, o.quantity, o.total, o.status
       FROM orders o
       JOIN users u    ON u.id = o.user_id
       JOIN products p ON p.id = o.product_id`);
  console.log('2. SELECT with JOIN — orders:');
  console.table(orders);

  // 3. SELECT unique (DISTINCT)
  const [cats] = await con.query('SELECT DISTINCT category FROM products ORDER BY category');
  console.log('3. SELECT DISTINCT — unique categories:', cats.map((c) => c.category).join(', '));

  // 4. DELETE a record
  const [del] = await con.query('DELETE FROM orders ORDER BY id DESC LIMIT 1');
  console.log(`4. DELETE — removed ${del.affectedRows} order record(s)`);

  // 5. DROP TABLE (orders is dropped last because nothing depends on it;
  //    run mysql-1.js again to create it back)
  await con.query('DROP TABLE IF EXISTS orders');
  console.log('5. DROP TABLE — "orders" table dropped');

  const [tables] = await con.query('SHOW TABLES');
  console.log('   Tables left:', tables.map((t) => Object.values(t)[0]).join(', '));

  await con.end();
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
