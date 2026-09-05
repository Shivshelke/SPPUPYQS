require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function fixSlugs() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const products = await Product.find({ slug: { $exists: false } });
  console.log(`Found ${products.length} products without slugs.`);

  for (const product of products) {
    const baseSlug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    product.slug = slug;
    await product.save();
    console.log(`Updated product: ${product.title} -> ${slug}`);
  }

  // Also check products that have slug but it's null
  const nullProducts = await Product.find({ slug: null });
  for (const product of nullProducts) {
    const baseSlug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    product.slug = slug;
    await product.save();
    console.log(`Updated product (was null): ${product.title} -> ${slug}`);
  }

  console.log('Done fixing slugs.');
  mongoose.disconnect();
}

fixSlugs().catch(console.error);
