const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main_banner' },
  text: { type: String, required: true },
  link: { type: String, default: '' },
  isActive: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
