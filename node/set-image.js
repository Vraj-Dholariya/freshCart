/* ============================================================
   Use YOUR OWN photo (or any web link) for a product.

   Usage (run from the freshcart folder):
     node node/set-image.js <product name or id> <photo file or web link>
     node node/set-image.js <product name or id> --reset

   Examples:
     node node/set-image.js Peaches "C:\Users\me\Pictures\my-peach.jpg"
     node node/set-image.js p06 ~/Downloads/peach.png
     node node/set-image.js "Cherry tomatoes" https://example.com/tomatoes.jpg
     node node/set-image.js Peaches --reset        (back to the automatic photo)

   What it does:
     - copies your photo into the images/ folder (named after the product)
     - writes "image": "images/<name>.jpg" for that product in data/products.json
     - refreshes data/products.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const jsonFile = path.join(__dirname, '..', 'data', 'products.json');
const imagesDir = path.join(__dirname, '..', 'images');
const [, , ref, source] = process.argv;

function fail(msg) {
  console.error('\n' + msg + '\n');
  process.exit(1);
}

if (!ref || !source) {
  fail('Usage: node node/set-image.js <product name or id> <photo file or web link | --reset>\n' +
       'Example: node node/set-image.js Peaches "C:\\Users\\me\\Pictures\\my-peach.jpg"');
}

const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
const wanted = ref.trim().toLowerCase();
const product =
  data.products.find((p) => p.id.toLowerCase() === wanted) ||
  data.products.find((p) => p.name.toLowerCase() === wanted) ||
  data.products.find((p) => p.name.toLowerCase().startsWith(wanted));

if (!product) {
  fail('No product called "' + ref + '". Products are:\n  ' +
       data.products.map((p) => p.id + '  ' + p.name).join('\n  '));
}

if (source === '--reset') {
  product.image = '';
  console.log('✔ ' + product.name + ': back to the automatic photo.');
} else if (/^https?:\/\//i.test(source)) {
  product.image = source;
  console.log('✔ ' + product.name + ': now uses ' + source);
} else {
  const file = path.resolve(source);
  if (!fs.existsSync(file)) fail('Cannot find the file: ' + file + '\nTip: put the path in "quotes", and check the spelling.');

  const ext = path.extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) {
    fail('Please use a .jpg, .png, .webp, .gif or .avif photo (yours is "' + ext + '").');
  }

  const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.copyFileSync(file, path.join(imagesDir, slug + ext));
  product.image = 'images/' + slug + ext;
  console.log('✔ ' + product.name + ': copied your photo to ' + product.image);
}

fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
require('./build-data.js');          // refreshes data/products.js
console.log('Done. Refresh the browser (Ctrl+F5) to see it.');
