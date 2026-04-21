'use strict';
require('dotenv').config();
const db = require('./src/db');
db.query("DELETE FROM students WHERE email LIKE '%test%'")
  .then(r => { console.log('Deleted', r.rowCount, 'test students'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
