const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  const result = await Product.deleteMany({});
  console.log(`Deleted ${result.deletedCount} products`);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
