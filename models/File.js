const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  originalName: String,
  storedName: String,
  year: String,
  branch: String,
  subject: String,
  semester: String,
  size: Number,
  uploadDate: { type: Date, default: Date.now },
  uploadedBy: String,
  url: String,
  publicId: String,
  contentType: { type: String, default: 'regular' },
  pattern: { type: String, default: '2024' }
});
module.exports = mongoose.model('File', schema);
