require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Condition 1: strict pattern match
  const result1 = await File.deleteMany({
    year: 'third',
    pattern: '2019',
    url: { $regex: /drive\.google\.com/i }
  });
  
  // Condition 2: mismatched pattern but subject/originalName contains 2019
  const result2 = await File.deleteMany({
    year: 'third',
    url: { $regex: /drive\.google\.com/i },
    $or: [
      { subject: { $regex: /2019/i } },
      { originalName: { $regex: /2019/i } }
    ]
  });
  
  console.log(`Successfully deleted ${result1.deletedCount} files (strict '2019' pattern) for 3rd year.`);
  console.log(`Successfully deleted ${result2.deletedCount} files (missed tags with '2019' in name) for 3rd year.`);
  console.log(`Total 3rd year 2019 pattern papers deleted: ${result1.deletedCount + result2.deletedCount}`);
  
  await mongoose.disconnect();
}
run().catch(console.error);
