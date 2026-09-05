require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await File.deleteMany({ 
    year: 'second', 
    url: { $regex: /drive\.google\.com/i },
    $or: [
      { subject: { $regex: /2019/i } },
      { originalName: { $regex: /2019/i } }
    ]
  });
  
  console.log(`Successfully deleted ${result.deletedCount} missed files for 2nd year with '2019' in subject/originalName.`);
  
  await mongoose.disconnect();
}
run().catch(console.error);
