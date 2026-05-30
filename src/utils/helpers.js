const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { ADMIN_IDS } = require('../config');

function generateReferralCode(telegramId) {
  return `OTP${telegramId}X`;
}

function generateGiftCode(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'OTPX-';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

function formatCoins(n) {
  return Number(n).toLocaleString('en-IN');
}

function formatDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function hashFingerprint(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function splitArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanServiceName(name) {
  return name.replace(/[^\w\s-]/g, '').trim().toUpperCase();
}

module.exports = {
  generateReferralCode,
  generateGiftCode,
  isAdmin,
  formatCoins,
  formatDate,
  timeAgo,
  hashFingerprint,
  splitArray,
  escapeMarkdown,
  sleep,
  cleanServiceName,
};
