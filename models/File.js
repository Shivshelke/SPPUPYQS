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
  pattern: { type: String, default: '2024' },
  downloadGate: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['none', 'whatsapp'], default: 'none' },
    whatsappUrl: { type: String, default: '' }
  },
  solutionUrl: { type: String, default: '' },
  solutionType: { type: String, enum: ['file', 'link', 'none'], default: 'none' },
  solutionOriginalName: { type: String, default: '' },
  solutionPublicId: { type: String, default: '' },
  solutionUploadDate: { type: Date }
});
module.exports = mongoose.model('File', schema);
