// seed.js — run with `npm run seed`
// Regenerates backend/data/db.json from seed-data.js, overwriting any
// changes made through the API (new students, recorded payments, etc).

const db = require('./db');

const fresh = db.reset();
console.log(`Seeded ${fresh.students.length} students for "${fresh.schools[0].name}".`);
console.log('Run `npm start` to launch the API.');
