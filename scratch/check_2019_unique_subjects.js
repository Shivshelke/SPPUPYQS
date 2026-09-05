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
  
  const subjects = [...new Set(files.map(f => f.subject))];
  console.log("Subjects found:");
  console.log(subjects);
  
  await mongoose.disconnect();
}
run().catch(console.error);
