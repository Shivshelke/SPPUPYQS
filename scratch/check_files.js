require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find unique years and patterns
  const years = await File.distinct('year');
  console.log("Distinct Years:", years);
  
  const patterns = await File.distinct('pattern');
  console.log("Distinct Patterns:", patterns);

  const secondYearFiles = await File.find({ 
    year: { $regex: /2nd|second/i }, 
    pattern: '2019',
    url: { $regex: /drive\.google\.com/i }
  });
  
  console.log(`Found ${secondYearFiles.length} files matching: 2nd year, 2019 pattern, google drive url`);
  
  const allSecondYear2019Files = await File.find({ 
    year: { $regex: /2nd|second/i }, 
    pattern: '2019'
  });
  console.log(`Found ${allSecondYear2019Files.length} files matching: 2nd year, 2019 pattern (any URL or no URL)`);
  
  if (secondYearFiles.length > 0) {
    console.log("Sample file:");
    console.log(secondYearFiles[0]);
  } else if (allSecondYear2019Files.length > 0) {
    console.log("Sample file (any URL):");
    console.log(allSecondYear2019Files[0]);
  }
  
  await mongoose.disconnect();
}
run().catch(console.error);
