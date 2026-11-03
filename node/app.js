/* Practical 1-IV and 2-I — create a JSON object, show it in the terminal,
   and store it in a file.
   Run:  node node/app.js                                                */

const fs = require('fs');
const path = require('path');

// 1. A JSON object describing the store
const storeInfo = {
  name: 'freshcart',
  tagline: 'Fresh groceries, delivered',
  city: 'Gujarat',
  open: true,
  categories: ['Vegetables', 'Fruit', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Herbs'],
  delivery: { freeAbove: 499, fee: 30, currency: 'INR' }
};

// 2. Display it in the terminal (2 = indent with two spaces)
console.log('--- JSON object ---');
console.log(JSON.stringify(storeInfo, null, 2));

// 3. Store it in a file
const outFile = path.join(__dirname, 'store-info.json');
fs.writeFileSync(outFile, JSON.stringify(storeInfo, null, 2));
console.log('\nSaved to ' + outFile);

// Practical 1-V — the application title used for practicals 2 to 10
console.log('\nApplication title: freshcart — Online Grocery Store');
