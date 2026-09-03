const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendPurchaseEmail = async (studentEmail, studentName, productTitle, amountPaid, orderId) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Skipping email send: EMAIL_USER or EMAIL_PASS not configured.');
    return;
  }

  const isFree = amountPaid === 0;
  const priceDisplay = isFree ? 'Free' : `₹${amountPaid}`;
  const subject = isFree ? `Your Free Material: ${productTitle}` : `Payment Receipt: ${productTitle}`;

  const htmlTemplate = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
      .header { background: #3b82f6; padding: 30px 20px; text-align: center; color: white; }
      .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
      .content { padding: 30px; }
      .content h2 { color: #0f172a; margin-top: 0; }
      .details { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
      .details-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; }
      .details-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .label { font-weight: 600; color: #64748b; }
      .value { font-weight: 700; color: #0f172a; text-align: right; max-width: 70%; }
      .btn-container { text-align: center; margin: 30px 0; }
      .btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background 0.2s; }
      .btn:hover { background: #2563eb; }
      .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>SYNAPSE</h1>
      </div>
      <div class="content">
        <h2>Hi ${studentName},</h2>
        <p>Thank you for your ${isFree ? 'request' : 'purchase'}! Your study material is ready to be accessed.</p>
        
        <div class="details">
          <div class="details-row">
            <span class="label">Product:</span>
            <span class="value">${productTitle}</span>
          </div>
          <div class="details-row">
            <span class="label">Amount Paid:</span>
            <span class="value">${priceDisplay}</span>
          </div>
          <div class="details-row">
            <span class="label">Order ID:</span>
            <span class="value">${orderId}</span>
          </div>
          <div class="details-row">
            <span class="label">Date:</span>
            <span class="value">${new Date().toLocaleString()}</span>
          </div>
        </div>

        <div class="btn-container">
          <a href="http://localhost:3000/my-purchases.html" class="btn">View & Download Material</a>
        </div>
        
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">
          If you have any questions or need help with your material, simply reply to this email.
        </p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Synapse. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: '"Synapse SPPU" <' + process.env.EMAIL_USER + '>',
    to: studentEmail,
    subject: subject,
    html: htmlTemplate
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

module.exports = { sendPurchaseEmail };
