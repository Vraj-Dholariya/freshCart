/* Practical 2-III — multi-dimensional JSON arrays, and accessing
   individual elements.
   Run:  node node/json-arrays.js                                        */

// A 2-D array (rows x columns): delivery slots for each day
const slots = [
  ['Mon', '7-9 am', '5-7 pm'],
  ['Tue', '7-9 am', '9-11 am'],
  ['Wed', '9-11 am', '5-7 pm']
];

// A 3-D array: for each day, a list of [product, quantity] pairs
const weeklyBasket = [
  [['Carrots', 2], ['Spinach', 1]],                 // Monday
  [['Whole milk', 2], ['Free-range eggs', 1]],      // Tuesday
  [['Sourdough loaf', 1], ['Butter', 1], ['Honey', 1]]  // Wednesday
];

// A JSON object that contains a 2-D array (prices by category, per unit)
const priceGrid = {
  headers: ['Vegetables', 'Fruit', 'Dairy'],
  rows: [
    [40, 120, 64],
    [60, 50, 90],
    [30, 180, 110]
  ]
};

console.log('--- The arrays as JSON ---');
console.log(JSON.stringify({ slots, weeklyBasket, priceGrid }, null, 2));

console.log('\n--- Accessing individual elements ---');
console.log('slots[1][0]           =', slots[1][0]);            // Tue
console.log('slots[2][2]           =', slots[2][2]);            // 5-7 pm
console.log('weeklyBasket[2][1][0] =', weeklyBasket[2][1][0]);  // Butter
console.log('weeklyBasket[0][0][1] =', weeklyBasket[0][0][1]);  // 2
console.log('priceGrid.rows[1][2]  =', priceGrid.rows[1][2]);   // 90

console.log('\n--- Looping through every element ---');
weeklyBasket.forEach((day, d) => {
  console.log(slots[d][0] + ':');
  day.forEach(([name, qty]) => console.log(`   ${name} x ${qty}`));
});

console.table(slots);
