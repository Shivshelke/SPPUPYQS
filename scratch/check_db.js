const mongoose = require('mongoose');
require('dotenv').config();
const File = require('../models/File');

async function checkDb() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const count = await File.countDocuments();
    console.log(`Total Files: ${count}`);

    const files = await File.find().limit(5);
    console.log('Sample Files:', JSON.stringify(files, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkDb();
