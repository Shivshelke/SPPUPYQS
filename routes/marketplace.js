const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Order = require('../models/Order');

// Initialize Razorpay
// Using dummy keys if env variables are not present yet
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// GET /api/marketplace/products
router.get('/products', async (req, res) => {
  try {
    const { year, branch, semester, content, search } = req.query;
    const query = { isPublished: true };
    
    if (year && year !== 'all') query.year = year;
    if (branch && branch !== 'all') query.branch = branch;
    if (semester && semester !== 'all') query.semester = semester;
    if (content && content !== 'all') query.contentType = content;
    
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ title: regex }, { subject: regex }, { branch: regex }];
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Marketplace Products API Error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/marketplace/product/:id
router.get('/product/:id', async (req, res) => {
  try {
    let product;
    if (require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id);
    }
    if (!product) {
      product = await Product.findOne({ slug: req.params.id });
    }
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/marketplace/create-order
router.post('/create-order', async (req, res) => {
  try {
    if (!req.session || !req.session.isStudent) {
      return res.status(401).json({ error: 'Please login to purchase.' });
    }

    const { productId } = req.body;
    let product;
    if (require('mongoose').Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    if (!product) {
      product = await Product.findOne({ slug: productId });
    }
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const amount = product.discountPrice ? product.discountPrice : product.price;

    const options = {
      amount: amount * 100, // amount in the smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    // Save preliminary order
    const newOrder = await Order.create({
      user: req.session.studentUserId, // Assuming we saved _id in session, if not we need to fetch it
      items: [{ product: product._id }],
      amount: amount,
      paymentGateway: 'razorpay',
      orderId: order.id,
      status: 'pending'
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
      dbOrderId: newOrder._id
    });
  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/marketplace/verify-payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment successful
      const order = await Order.findById(dbOrderId);
      if (!order) return res.status(404).json({ error: 'Order not found in DB' });

      order.status = 'completed';
      order.paymentId = razorpay_payment_id;
      await order.save();

      // Create Purchase record
      for (let item of order.items) {
        await Purchase.create({
          user: order.user,
          product: item.product,
          bundle: item.bundle,
          orderId: order._id,
          pricePaid: order.amount
        });
      }

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Signature verification failed' });
    }
  } catch (err) {
    console.error('Verify Payment Error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// GET /api/marketplace/my-purchases
router.get('/my-purchases', async (req, res) => {
  try {
    if (!req.session || !req.session.isStudent) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const purchases = await Purchase.find({ user: req.session.studentUserId })
      .populate('product')
      .sort({ purchasedAt: -1 });

    res.json(purchases);
  } catch (err) {
    console.error('My Purchases API Error:', err);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

module.exports = router;
