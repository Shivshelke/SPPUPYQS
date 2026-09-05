require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await File.deleteMany({
    year: 'second',
    pattern: '2019',
    url: { $regex: /drive\.google\.com/i }
  });
  
  console.log(`Successfully deleted ${result.deletedCount} files for 2nd year, 2019 pattern with Google Drive links.`);
  
  await mongoose.disconnect();
}
run().catch(console.error);
