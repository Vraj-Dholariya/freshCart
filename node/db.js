/* Shared helper for the MySQL practicals (I, II) and the RBAC practical (9).
   Change the connection settings here, or set them as environment variables:
     DB_HOST, DB_USER, DB_PASSWORD, DB_NAME                                  */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

const DB_NAME = process.env.DB_NAME || 'freshcart_db';

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'vraj6282'      // <-- put your MySQL password here
};

// connection WITHOUT a database (used to create the database itself)
const connectServer = () => mysql.createConnection(config);
// connection TO freshcart_db
const connectDb = () => mysql.createConnection({ ...config, database: DB_NAME });

// passwords are stored as "salt:hash" (scrypt) — never as plain text
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(password, salt, 32).toString('hex');
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

module.exports = { DB_NAME, connectServer, connectDb, hashPassword, verifyPassword };
