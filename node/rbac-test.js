/* Calls the RBAC API (node/rbac.js must be running) as each role and prints
   what is allowed (200/201) and what is blocked (401/403).
   Run:  node node/rbac-test.js                                              */

const BASE = 'http://localhost:' + (process.env.RBAC_PORT || 4000);

async function call(label, method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  console.log(`${String(res.status).padEnd(4)} ${label.padEnd(34)} ${data.error || data.message || (Array.isArray(data) ? data.length + ' rows' : data.role || '')}`);
  return data;
}

async function main() {
  const login = (email, password) => call(`login ${email}`, 'POST', '/login', null, { email, password });

  console.log('--- No login ---');
  await call('GET /products (no token)', 'GET', '/products');
  await call('login with wrong password', 'POST', '/login', null, { email: 'user@freshcart.com', password: 'nope' });

  console.log('\n--- Customer ---');
  const c = (await login('user@freshcart.com', 'password123')).token;
  await call('GET /products', 'GET', '/products', c);
  await call('GET /orders (own only)', 'GET', '/orders', c);
  await call('POST /products', 'POST', '/products', c, { id: 'x1', name: 'Test', category: 'fruit', price: 10 });
  await call('GET /users', 'GET', '/users', c);

  console.log('\n--- Grower ---');
  const g = (await login('farmer@freshcart.com', 'growerpass123')).token;
  await call('POST /products (add own)', 'POST', '/products', g, { id: 'x1', name: 'Test Mango', category: 'fruit', price: 99 });
  await call('DELETE /products/x1 (own)', 'DELETE', '/products/x1', g);
  await call('GET /orders', 'GET', '/orders', g);
  await call('GET /users', 'GET', '/users', g);

  console.log('\n--- Admin ---');
  const a = (await login('admin@freshcart.com', 'admin123')).token;
  await call('GET /orders (all)', 'GET', '/orders', a);
  await call('GET /users', 'GET', '/users', a);
  await call('DELETE /products/p28 (any)', 'DELETE', '/products/p28', a);
}

main().catch((e) => console.error('Is "node node/rbac.js" running?', e.message));
