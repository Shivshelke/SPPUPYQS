const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('./models/Student');

async function revokePremium() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const result = await Student.updateMany(
      { isPremium: true },
      { $set: { isPremium: false, premiumStatus: 'none' } }
    );
    
    console.log(`Successfully revoked premium access for ${result.modifiedCount} students.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

revokePremium();
