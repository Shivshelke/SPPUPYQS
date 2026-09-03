const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String },
  year: { type: String },
  semester: { type: String },
  branch: { type: String },
  subject: { type: String },
  contentType: { type: String, enum: ['pyq', 'notes', 'imp', 'solved', 'micro'] },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discountPrice: { type: Number },
  pdfUrl: { type: String },
  previewUrl: { type: String },
  thumbnailUrl: { type: String },
  isPublished: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
