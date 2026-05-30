const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const { DEFAULTS } = require('../config');

const Settings = sequelize.define('Settings', {
  key:   { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.JSONB, allowNull: true },
}, { tableName: 'settings', timestamps: true });

const defaultSettings = {
  coin_price: DEFAULTS.COIN_PRICE,
  min_deposit: DEFAULTS.MIN_DEPOSIT,
  max_deposit: DEFAULTS.MAX_DEPOSIT,
  per_refer_coins: DEFAULTS.PER_REFER_COINS,
  new_user_bonus: DEFAULTS.NEW_USER_BONUS,
  otp_cost: DEFAULTS.OTP_COST,
  max_otp_wait: DEFAULTS.MAX_OTP_WAIT,
  upi_id: process.env.UPI_ID || 'otpx@upi',
  upi_name: process.env.UPI_NAME || 'OtpX Service',
  support_username: process.env.SUPPORT_USERNAME || '@otpx_support',
  gemini_api_key: process.env.GEMINI_API_KEY || '',
  sms_api_key: process.env.SMS_API_KEY || '',
  maintenance_mode: false,
  registration_enabled: true,
  welcome_message: '👋 Welcome to *OtpX* - Your Premium OTP Service!\n\nGet OTPs for 4000+ services instantly.',
  referral_enabled: true,
  gift_code_enabled: true,
  auto_refund: true,
  broadcast_delay: 50,
  min_gift_deposit: 0,
};

async function getSetting(key) {
  try {
    const row = await Settings.findOne({ where: { key } });
    if (!row) return defaultSettings[key] !== undefined ? defaultSettings[key] : null;
    return row.value;
  } catch { return defaultSettings[key] !== undefined ? defaultSettings[key] : null; }
}

async function setSetting(key, value) {
  await Settings.upsert({ key, value });
}

async function getAllSettings() {
  const rows = await Settings.findAll();
  const result = { ...defaultSettings };
  for (const row of rows) result[row.key] = row.value;
  return result;
}

async function initSettings() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    const exists = await Settings.findOne({ where: { key } });
    if (!exists) await Settings.create({ key, value });
  }
}

module.exports = { Settings, getSetting, setSetting, getAllSettings, initSettings };
