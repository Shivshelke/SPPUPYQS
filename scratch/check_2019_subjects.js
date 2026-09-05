require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const files = await File.find({ 
    year: 'second', 
    url: { $regex: /drive\.google\.com/i },
    $or: [
      { subject: { $regex: /2019/i } },
      { originalName: { $regex: /2019/i } }
    ]
  });
  console.log(`Found ${files.length} files for 2nd year with '2019' in subject or originalName`);
  
  if (files.length > 0) {
    console.log("Sample file:");
    console.log(files[0]);
  }
  
  await mongoose.disconnect();
}
run().catch(console.error);
