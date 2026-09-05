require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const files = await File.find({ subject: { $regex: /Computer Graphics/i } });
  console.log(`Found ${files.length} files for Computer Graphics`);
  if (files.length > 0) {
    console.log("Sample file for CG:");
    console.log(files[0]);
  }
  
  await mongoose.disconnect();
}
run().catch(console.error);
