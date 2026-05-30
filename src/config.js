require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  PORT: parseInt(process.env.PORT) || 3000,
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  MINI_APP_URL: process.env.MINI_APP_URL || '',

  // Admin IDs
  ADMIN_IDS: [8004114088, 7291283007],

  // Channel & Group
  CHANNEL_USERNAME: '@otp_X_official',
  CHANNEL_ID: -1003851686498,
  GROUP_USERNAME: '@otpxDiscuss',
  GROUP_ID: -1003956479106,

  // Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // SMS API
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_API_URL: process.env.SMS_API_URL || 'https://api.sms-activate.org/stubs/handler_api.php',

  // Payment
  UPI_ID: process.env.UPI_ID || 'otpx@upi',
  UPI_NAME: process.env.UPI_NAME || 'OtpX Service',

  // Support
  SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || '@otpx_support',

  // Default Settings
  DEFAULTS: {
    COIN_PRICE: 1,         // 1 coin = 1 INR
    MIN_DEPOSIT: 10,       // min 10 INR
    MAX_DEPOSIT: 10000,    // max 10000 INR
    PER_REFER_COINS: 5,    // 5 coins per refer
    NEW_USER_BONUS: 2,     // 2 free coins on join
    OTP_COST: 3,           // 3 coins per OTP
    MAX_OTP_WAIT: 300,     // 5 minutes
  },

  // Pagination
  SERVICES_PER_PAGE: 8,
  USERS_PER_PAGE: 10,
  HISTORY_PER_PAGE: 8,
};
