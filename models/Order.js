const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    bundle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle' }
  }],
  amount: { type: Number, required: true },
  paymentGateway: { type: String, default: 'razorpay' },
  paymentId: { type: String }, // Gateway ID
  orderId: { type: String }, // Gateway Order ID
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
