const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  bundle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle' },
  orderId: { type: String }, // Links to Order
  purchasedAt: { type: Date, default: Date.now },
  pricePaid: { type: Number, required: true }
});

module.exports = mongoose.model('Purchase', purchaseSchema);
