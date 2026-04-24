'use strict';

require('dotenv').config();
const StudentModel = require('./src/models/student.model');
const logger = require('./src/utils/logger');
const db = require('./src/db/index');

async function test() {
  try {
    const studentCode = 'STU-99999';
    const data = {
      name: 'Test Upload',
      email: 'testupload@academy.edu',
      grade: '11th Grade',
      major: 'Computer Science',
      semester: '1st / Fall',
      attendance: 90,
      score: 7.5
    };
    
    logger.info('Attempting to create student...');
    const result = await StudentModel.create({
      studentCode,
      ...data
    }, null);
    
    logger.info('Created:', result);
  } catch(err) {
    logger.error('Failed:', err.message);
    logger.error(err.stack);
  } finally {
    process.exit();
  }
}

test();
