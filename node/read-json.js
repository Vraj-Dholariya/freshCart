/* Practical 2-II — read and display the content of an external JSON file.
   Run:  node node/read-json.js                                          */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'products.json');

try {
  const text = fs.readFileSync(file, 'utf-8');   // 1. read the file as text
  const data = JSON.parse(text);                  // 2. turn the text into a JS object

  console.log('Store:', data.store.name, '—', data.store.tagline);
  console.log('Products in file:', data.products.length);

  // 3. show a few fields of every product as a table
  console.table(data.products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: '₹' + p.price,
    unit: p.unit
  })));

  // 4. reach into a nested object (nutrition inside a product)
  const first = data.products[0];
  console.log(`\n${first.name} nutrition per ${first.nutrition.per}:`, first.nutrition);
} catch (err) {
  console.error('Could not read ' + file + ':', err.message);
}
