const { Markup } = require('telegraf');
const { getServicePage } = require('./services');

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎯 Get OTP', 'menu:getotp'),
      Markup.button.callback('💰 Deposit', 'menu:deposit'),
    ],
    [
      Markup.button.callback('👤 Profile', 'menu:profile'),
      Markup.button.callback('🆘 Support', 'menu:support'),
    ],
    [
      Markup.button.callback('📊 Status', 'menu:status'),
    ],
  ]);
}

function profileKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💎 My Balance', 'profile:balance'),
      Markup.button.callback('🔗 Refer', 'profile:refer'),
    ],
    [
      Markup.button.callback('📜 History', 'profile:history:0'),
      Markup.button.callback('🎁 Gift Code', 'profile:giftcode'),
    ],
    [Markup.button.callback('🔙 Back', 'menu:main')],
  ]);
}

function backToMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Menu', 'menu:main')],
  ]);
}

function backToProfileKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back', 'menu:profile')],
  ]);
}

function depositKeyboard(upiId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📲 UPI / QR Code', 'deposit:showupi')],
    [Markup.button.callback('✅ I Have Paid', 'deposit:paid')],
    [Markup.button.callback('🔙 Back', 'menu:main')],
  ]);
}

function depositConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📸 Submit Payment Proof', 'deposit:submit')],
    [Markup.button.callback('❌ Cancel', 'menu:main')],
  ]);
}

function servicesKeyboard(page = 0, query = '') {
  const { items, totalPages } = getServicePage(page, 8, query);
  const buttons = items.map(svc =>
    [Markup.button.callback(`${svc.name}`, `otp:select:${svc.code}:${page}`)]
  );

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️ Prev', `otp:page:${page - 1}:${query}`));
  nav.push(Markup.button.callback(`📄 ${page + 1}/${totalPages}`, 'noop'));
  if (page < totalPages - 1) nav.push(Markup.button.callback('Next ➡️', `otp:page:${page + 1}:${query}`));
  if (nav.length > 0) buttons.push(nav);

  buttons.push([
    Markup.button.callback('🔍 Search', 'otp:search'),
    Markup.button.callback('🔙 Back', 'menu:main'),
  ]);

  return Markup.inlineKeyboard(buttons);
}

function otpOrderKeyboard(activationId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Check OTP', `otp:check:${activationId}`)],
    [Markup.button.callback('❌ Cancel Order', `otp:cancel:${activationId}`)],
  ]);
}

function historyKeyboard(orders, page, totalPages) {
  const buttons = orders.map(o =>
    [Markup.button.callback(
      `${o.service} - ${o.status === 'received' ? '✅' : '❌'}`,
      `history:detail:${o._id}`
    )]
  );

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `profile:history:${page - 1}`));
  if (totalPages > 1) nav.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'));
  if (page < totalPages - 1) nav.push(Markup.button.callback('➡️', `profile:history:${page + 1}`));
  if (nav.length > 0) buttons.push(nav);

  buttons.push([Markup.button.callback('🔙 Back', 'menu:profile')]);
  return Markup.inlineKeyboard(buttons);
}

function adminMainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚙️ Settings', 'admin:settings'),
      Markup.button.callback('👥 Users', 'admin:users'),
    ],
    [
      Markup.button.callback('💰 Deposits', 'admin:deposits'),
      Markup.button.callback('📦 Orders', 'admin:orders'),
    ],
    [
      Markup.button.callback('🎁 Gift Codes', 'admin:giftcodes'),
      Markup.button.callback('📢 Broadcast', 'admin:broadcast'),
    ],
    [
      Markup.button.callback('📊 Analytics', 'admin:analytics'),
      Markup.button.callback('🔒 Security', 'admin:security'),
    ],
    [
      Markup.button.callback('💳 Financial', 'admin:financial'),
      Markup.button.callback('🤖 Bot Config', 'admin:botconfig'),
    ],
    [
      Markup.button.callback('🛠️ SMS API', 'admin:smsapi'),
      Markup.button.callback('🤖 Gemini AI', 'admin:gemini'),
    ],
  ]);
}

function adminSettingsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 Coin Price (INR)', 'admin:set:coin_price')],
    [Markup.button.callback('📥 Min Deposit', 'admin:set:min_deposit')],
    [Markup.button.callback('📤 Max Deposit', 'admin:set:max_deposit')],
    [Markup.button.callback('🔗 Per Refer Coins', 'admin:set:per_refer_coins')],
    [Markup.button.callback('🎁 New User Bonus', 'admin:set:new_user_bonus')],
    [Markup.button.callback('🎯 OTP Cost (coins)', 'admin:set:otp_cost')],
    [Markup.button.callback('⏱️ Max OTP Wait (sec)', 'admin:set:max_otp_wait')],
    [Markup.button.callback('📲 UPI ID', 'admin:set:upi_id')],
    [Markup.button.callback('👤 UPI Name', 'admin:set:upi_name')],
    [Markup.button.callback('🆘 Support Username', 'admin:set:support_username')],
    [Markup.button.callback('🛠️ Maintenance Mode', 'admin:toggle:maintenance_mode')],
    [Markup.button.callback('📝 Welcome Message', 'admin:set:welcome_message')],
    [Markup.button.callback('🔙 Back', 'admin:main')],
  ]);
}

function adminDepositsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏳ Pending Deposits', 'admin:deposits:pending:0')],
    [Markup.button.callback('✅ Approved Deposits', 'admin:deposits:approved:0')],
    [Markup.button.callback('❌ Rejected Deposits', 'admin:deposits:rejected:0')],
    [Markup.button.callback('📋 All Deposits', 'admin:deposits:all:0')],
    [Markup.button.callback('🔙 Back', 'admin:main')],
  ]);
}

function adminGiftCodesKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Create Gift Code', 'admin:giftcode:create')],
    [Markup.button.callback('📋 View All Codes', 'admin:giftcode:list:0')],
    [Markup.button.callback('🗑️ Delete Code', 'admin:giftcode:delete')],
    [Markup.button.callback('📊 Code Statistics', 'admin:giftcode:stats')],
    [Markup.button.callback('🔙 Back', 'admin:main')],
  ]);
}

function depositApproveKeyboard(depositId, userId, coins) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `admin:deposit:approve:${depositId}`),
      Markup.button.callback('❌ Reject', `admin:deposit:reject:${depositId}`),
    ],
    [Markup.button.callback('👤 View User', `admin:user:view:${userId}`)],
  ]);
}

function userManageKeyboard(userId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 Add Balance', `admin:user:addbal:${userId}`),
      Markup.button.callback('💸 Deduct Balance', `admin:user:deductbal:${userId}`),
    ],
    [
      Markup.button.callback('🚫 Ban User', `admin:user:ban:${userId}`),
      Markup.button.callback('✅ Unban', `admin:user:unban:${userId}`),
    ],
    [
      Markup.button.callback('⭐ Make VIP', `admin:user:vip:${userId}`),
      Markup.button.callback('📜 History', `admin:user:history:${userId}`),
    ],
    [Markup.button.callback('🔙 Back', 'admin:users')],
  ]);
}

module.exports = {
  mainMenuKeyboard,
  profileKeyboard,
  backToMainKeyboard,
  backToProfileKeyboard,
  depositKeyboard,
  depositConfirmKeyboard,
  servicesKeyboard,
  otpOrderKeyboard,
  historyKeyboard,
  adminMainKeyboard,
  adminSettingsKeyboard,
  adminDepositsKeyboard,
  adminGiftCodesKeyboard,
  depositApproveKeyboard,
  userManageKeyboard,
};
