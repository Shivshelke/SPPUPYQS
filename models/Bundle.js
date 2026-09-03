const mongoose = require('mongoose');

const bundleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  thumbnailUrl: { type: String },
  isPublished: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bundle', bundleSchema);
