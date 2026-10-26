const mongoose = require('mongoose');

const telegramPromoSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'telegram_promo' },
  
  // Feature 1: Year Card Click Popup (Modal)
  popupEnabled: { type: Boolean, default: true },
  popupTitle: { type: String, default: 'Join {year} SPPU Telegram Community' },
  popupText: { type: String, default: 'Get In-Sem & End-Sem IMP Questions, Handwritten Notes, Solved Papers and Exam Alerts directly on Telegram!' },
  popupButtonText: { type: String, default: '🚀 Join Telegram Group' },
  popupContinueText: { type: String, default: 'Continue to Papers →' },

  // Feature 2: Browser Panel Banner (Above Branch Selection)
  bannerEnabled: { type: Boolean, default: true },
  bannerText: { type: String, default: '📢 {year} SPPU Discussion & IMPs Group' },
  bannerButtonText: { type: String, default: 'Join Telegram ↗' },

  // Telegram Links
  defaultUrl: { type: String, default: 'https://t.me/synapse_support_bot' },
  firstYearUrl: { type: String, default: '' },
  secondYearUrl: { type: String, default: '' },
  thirdYearUrl: { type: String, default: '' },
  fourthYearUrl: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('TelegramPromo', telegramPromoSchema);
