/* Regenerates data/products.js from data/products.json.
   data/products.json is the real data file. products.js is only a copy that
   lets the site still work when index.html is opened by double-clicking
   (file://), where browsers block fetch().

   Run this again whenever you edit products.json:
       node node/build-data.js                                            */

const fs = require('fs');
const path = require('path');

const jsonFile = path.join(__dirname, '..', 'data', 'products.json');
const jsFile = path.join(__dirname, '..', 'data', 'products.js');

const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
fs.writeFileSync(jsFile,
  '/* Generated from products.json by node/build-data.js — edit products.json, not this file. */\n' +
  'window.FRESHCART_DATA = ' + JSON.stringify(data, null, 2) + ';\n');
console.log('Wrote ' + jsFile + ' (' + data.products.length + ' products)');
