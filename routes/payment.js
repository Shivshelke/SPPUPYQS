const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendPurchaseEmail } = require('../utils/email');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Purchase = require('../models/Purchase');
const { requireAuth } = require('../middleware/auth');
const https = require('https');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

// POST /api/payment/create-order
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    let product;
    if (require('mongoose').Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    if (!product) {
      product = await Product.findOne({ slug: productId });
    }
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Check if user already purchased this product
    const existingPurchase = await Purchase.findOne({ user: req.user._id, product: product._id });
    if (existingPurchase) {
      return res.status(400).json({ error: 'You have already purchased this product' });
    }

    if (product.price === 0) {
      const newPurchase = new Purchase({
        user: req.user._id,
        product: product._id,
        pricePaid: 0
      });
      await newPurchase.save();

      // Send email receipt asynchronously
      sendPurchaseEmail(req.user.email, req.user.username, product.title, 0, newPurchase._id).catch(console.error);

      return res.json({
        success: true,
        isFree: true
      });
    }

    // Razorpay amount is in paise (multiply by 100)
    const options = {
      amount: Math.round(product.price * 100),
      currency: 'INR',
      receipt: `receipt_${req.user._id}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    // Save pending order to our DB
    const newOrder = new Order({
      user: req.user._id,
      items: [{ product: productId }],
      amount: product.price,
      orderId: order.id,
      status: 'pending'
    });
    await newOrder.save();

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/payment/verify-payment
router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Signature is valid
      const order = await Order.findOne({ orderId: razorpay_order_id }).populate('items.product');
      if (!order) return res.status(404).json({ error: 'Order not found' });

      order.paymentId = razorpay_payment_id;
      order.status = 'completed';
      await order.save();

      // Create a Purchase record for each item in the order
      for (const item of order.items) {
        if (item.product) {
          const purchase = new Purchase({
            user: req.user._id,
            product: item.product._id, // Use _id since it's populated
            orderId: order.id,
            pricePaid: order.amount
          });
          await purchase.save();
          
          // Send email receipt asynchronously
          sendPurchaseEmail(req.user.email, req.user.username, item.product.title, order.amount, purchase._id).catch(console.error);
        }
      }

      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// GET /api/payment/my-purchases
router.get('/my-purchases', requireAuth, async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.user._id })
      .populate('product')
      .sort({ purchasedAt: -1 });
    res.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// GET /api/payment/stream/:productId
// Securely streams the PDF if the user has bought it
router.get('/stream/:productId', requireAuth, async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ user: req.user._id, product: req.params.productId }).populate('product');
    if (!purchase || !purchase.product) {
      return res.status(403).json({ error: 'Unauthorized. You have not purchased this item.' });
    }

    const pdfUrl = purchase.product.pdfUrl;
    if (!pdfUrl) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // If it's a Google Drive link, redirect instead of streaming
    // (Google Drive links return HTML viewer pages or require complex redirect handling)
    if (pdfUrl.includes('drive.google.com')) {
      return res.redirect(pdfUrl);
    }

    // Pipe the PDF from Cloudinary to the client securely
    https.get(pdfUrl, (pdfRes) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${purchase.product.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
      pdfRes.pipe(res);
    }).on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).end();
    });
      
  } catch (error) {
    console.error('Error streaming PDF:', error);
    res.status(500).json({ error: 'Failed to load PDF' });
  }
});

// POST /api/payment/webhook
// This receives Razorpay server-to-server notifications
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('Webhook failed: RAZORPAY_WEBHOOK_SECRET not configured in .env');
      return res.status(500).send('Webhook secret not configured');
    }

    // req.body is a Buffer here because we used express.raw() in server.js
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Webhook signature mismatch');
      return res.status(400).send('Invalid signature');
    }

    // Parse the raw body to JSON
    const payload = JSON.parse(req.body.toString());

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      
      if (orderId) {
        const order = await Order.findOne({ orderId: orderId });
        if (order && order.status !== 'completed') {
          // Verify payment in case frontend closed before completing
          order.paymentId = payment.id;
          order.status = 'completed';
          await order.save();

          for (const item of order.items) {
            if (item.product) {
              const existingPurchase = await Purchase.findOne({ user: order.user, product: item.product });
              if (!existingPurchase) {
                const purchase = new Purchase({
                  user: order.user,
                  product: item.product,
                  orderId: order.id,
                  pricePaid: order.amount
                });
                await purchase.save();
              }
            }
          }
          console.log(`Webhook: Successfully processed payment for order ${orderId}`);
        }
      }
    }
    
    // Always return 200 OK so Razorpay doesn't retry
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
