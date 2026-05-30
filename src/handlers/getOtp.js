const User = require('../models/User');
const OtpOrder = require('../models/OtpOrder');
const Transaction = require('../models/Transaction');
const { getSetting } = require('../models/Settings');
const { getServicePage, getServiceByCode } = require('../utils/services');
const { servicesKeyboard, backToMainKeyboard } = require('../utils/keyboards');
const { getNumberForService, releaseNumber, getSmsForNumber } = require('../utils/firebaseSms');
const { extractOtpFromSms } = require('../utils/gemini');
const { Markup } = require('telegraf');

const activePollMap = new Map();

async function handleGetOtp(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user || user.isBanned) return;
  const cost = user.customOtpCost ?? await getSetting('otp_cost');
  await ctx.editMessageText(
    `🎯 *Select a Service*\n\n💎 Balance: *${user.balance} coins*\n💰 Cost: *${cost} coins*\n\n4000+ Services Available:`,
    { parse_mode:'Markdown', ...servicesKeyboard(0,'') }
  ).catch(() => ctx.reply(`🎯 *Select a Service*\n\n💎 ${user.balance} coins | 💰 ${cost} coins`, { parse_mode:'Markdown', ...servicesKeyboard(0,'') }));
}

async function handleServicePage(ctx, page, query='') {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  const cost = user?.customOtpCost ?? await getSetting('otp_cost');
  await ctx.editMessageText(
    `🎯 *Select a Service*\n\n💎 *${user?.balance||0} coins* | 💰 *${cost} coins*\n${query?`🔍 "${query}"\n`:''}`,
    { parse_mode:'Markdown', ...servicesKeyboard(parseInt(page), query) }
  ).catch(() => {});
}

async function handleSearchOtp(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  ctx.session = ctx.session || {};
  ctx.session.awaitingOtpSearch = true;
  await ctx.reply(`🔍 *Search Service*\n\nType the service name:`, {
    parse_mode:'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'menu:getotp')]]),
  });
}

async function handleSelectService(ctx, serviceCode, fromPage=0) {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user || user.isBanned) return;
  const service = getServiceByCode(serviceCode);
  if (!service) return ctx.answerCbQuery('❌ Service not found', { show_alert:true });
  const cost = user.customOtpCost ?? await getSetting('otp_cost');
  if (user.balance < cost) return ctx.answerCbQuery(`❌ Need ${cost} coins, you have ${user.balance}.`, { show_alert:true });
  await ctx.editMessageText(
    `🎯 *Confirm OTP Order*\n\n📱 Service: *${service.name}*\n💰 Cost: *${cost} coins*\n💎 Balance: *${user.balance} coins*\n\nA real Indian number will be assigned. Register on *${service.name}* with it to get OTP automatically!`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirm', `otp:confirm:${serviceCode}`)],
      [Markup.button.callback('🔙 Back', `otp:page:${fromPage}:`)],
    ])}
  ).catch(() => {});
}

async function handleConfirmOtp(ctx, serviceCode) {
  await ctx.answerCbQuery('⏳ Getting number...').catch(() => {});
  const userId = ctx.from.id;
  const user = await User.findOne({ where: { telegramId: userId } });
  if (!user || user.isBanned) return;
  const service = getServiceByCode(serviceCode);
  if (!service) return ctx.reply('❌ Service not found.');
  const cost = user.customOtpCost ?? await getSetting('otp_cost');
  const maxWait = await getSetting('max_otp_wait') || 300;
  if (!user.canAfford(cost)) return ctx.reply(`❌ Need ${cost} coins, you have ${user.balance}.`);

  let numData;
  try { numData = await getNumberForService(); }
  catch (err) { return ctx.reply(`❌ *No Numbers Available*\n\n${err.message}`, { parse_mode:'Markdown', ...backToMainKeyboard() }); }

  const balBefore = user.balance;
  await user.deductBalance(cost);

  const startTime = Date.now();
  const order = await OtpOrder.create({
    userId, service: service.name, serviceCode,
    phoneNumber: numData.phoneNumber,
    activationId: numData.activationId,
    status: 'waiting', coinsCharged: cost,
    expiresAt: new Date(startTime + maxWait * 1000),
  });

  await Transaction.create({ userId, type:'otp_purchase', amount:-cost, description:`OTP for ${service.name}`, balanceBefore:balBefore, balanceAfter:user.balance, metadata:{ orderId:order.id, service:service.name } });
  user.totalOrders += 1;
  await user.save();

  const msg = await ctx.editMessageText(
    `✅ *Number Assigned!*\n\n📱 *${service.name}*\n📞 Number: \`+91${numData.phoneNumber}\`\n⏱️ Expires: *${Math.floor(maxWait/60)}m ${maxWait%60}s*\n💎 Charged: *${cost} coins*\n\n👆 Register using this number — OTP appears here automatically!`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Check OTP', `otp:check:${order.id}`)],
      [Markup.button.callback('❌ Cancel & Refund', `otp:cancel:${order.id}`)],
    ])}
  ).catch(() => ctx.reply(`✅ Number: \`+91${numData.phoneNumber}\`\n📱 ${service.name}`, { parse_mode:'Markdown' }));

  if (msg?.message_id) { order.messageId = msg.message_id; await order.save(); }
  startPolling(ctx, order, numData.entry, startTime, maxWait * 1000);
}

function startPolling(ctx, order, entry, startTime, timeoutMs) {
  const orderId = String(order.id);
  const knownKeys = new Set();
  const interval = setInterval(async () => {
    if (Date.now() - startTime > timeoutMs) {
      clearInterval(interval); activePollMap.delete(orderId);
      await handleExpired(ctx, order); return;
    }
    if (!activePollMap.has(orderId)) { clearInterval(interval); return; }
    try {
      const msgs = await getSmsForNumber(entry, startTime - 30000);
      const newMsg = msgs.find(m => !knownKeys.has(m.key));
      if (!newMsg) return;
      knownKeys.add(newMsg.key);
      let otp = await extractOtpFromSms(newMsg.text, order.service);
      if (!otp) { const m = newMsg.text.match(/\b\d{4,8}\b/); otp = m?.[0] || null; }
      if (!otp) return;
      clearInterval(interval); activePollMap.delete(orderId);
      releaseNumber(order.phoneNumber);
      await OtpOrder.findByIdAndUpdate(order.id, { otp, smsText:newMsg.text, status:'received', completedAt:new Date() });
      if (order.messageId) await ctx.telegram.deleteMessage(order.userId, order.messageId).catch(()=>{});
      await ctx.telegram.sendMessage(order.userId,
        `✅ *OTP Received!*\n\n📱 *${order.service}*\n📞 \`+91${order.phoneNumber}\`\n🔑 *OTP: \`${otp}\`*\n\n📩 SMS: _${newMsg.text}_`,
        { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🎯 Another OTP','menu:getotp')],[Markup.button.callback('🏠 Menu','menu:main')]]) }
      ).catch(()=>{});
    } catch {}
  }, 5000);
  activePollMap.set(orderId, interval);
}

async function handleExpired(ctx, order) {
  const o = await OtpOrder.findByIdAndUpdate(order.id, { status:'expired' });
  if (!o) return;
  releaseNumber(order.phoneNumber);
  if (await getSetting('auto_refund')) {
    const user = await User.findOne({ where: { telegramId: order.userId } });
    if (user) {
      await user.addBalance(order.coinsCharged);
      await Transaction.create({ userId:order.userId, type:'refund', amount:order.coinsCharged, description:`Auto refund - ${order.service} expired`, balanceAfter:user.balance });
    }
  }
  if (order.messageId) await ctx.telegram.deleteMessage(order.userId, order.messageId).catch(()=>{});
  const autoRefund = await getSetting('auto_refund');
  await ctx.telegram.sendMessage(order.userId,
    `⏰ *OTP Expired*\n\nService: *${order.service}*\n${autoRefund?`💰 *${order.coinsCharged} coins* refunded.`:'Contact support.'}`,
    { parse_mode:'Markdown', ...backToMainKeyboard() }
  ).catch(()=>{});
}

async function handleCheckOtp(ctx, orderId) {
  await ctx.answerCbQuery('🔄 Checking...').catch(() => {});
  const order = await OtpOrder.findByIdAndUpdate(orderId, {});
  if (!order) return ctx.answerCbQuery('Order not found', { show_alert:true });
  if (Number(order.userId) !== ctx.from.id) return ctx.answerCbQuery('Access denied', { show_alert:true });
  if (order.status === 'received' && order.otp) {
    await ctx.editMessageText(
      `✅ *OTP: \`${order.otp}\`*\n\n📱 ${order.service}`,
      { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Menu','menu:main')]]) }
    ).catch(()=>{});
    return;
  }
  const elapsed = Math.floor((Date.now() - new Date(order.createdAt)) / 1000);
  await ctx.answerCbQuery(`⏳ Waiting for OTP... (${elapsed}s)`, { show_alert:true });
}

async function handleCancelOtp(ctx, orderId) {
  await ctx.answerCbQuery('Cancelling...').catch(() => {});
  const order = await OtpOrder.findOne({ where: { id: orderId } });
  if (!order) return ctx.answerCbQuery('Not found', { show_alert:true });
  if (Number(order.userId) !== ctx.from.id) return ctx.answerCbQuery('Access denied', { show_alert:true });
  if (!['waiting','pending'].includes(order.status)) return ctx.answerCbQuery(`Status: ${order.status}`, { show_alert:true });
  if (activePollMap.has(orderId)) { clearInterval(activePollMap.get(orderId)); activePollMap.delete(orderId); }
  releaseNumber(order.phoneNumber);
  await OtpOrder.update({ status:'cancelled' }, { where: { id: orderId } });
  const user = await User.findOne({ where: { telegramId: order.userId } });
  if (user) {
    await user.addBalance(order.coinsCharged);
    await Transaction.create({ userId:Number(order.userId), type:'refund', amount:order.coinsCharged, description:`Cancelled - ${order.service}`, balanceAfter:user.balance });
  }
  await ctx.editMessageText(`❌ *Cancelled*\n\n💰 *${order.coinsCharged} coins* refunded.\n💎 Balance: *${user?.balance||0} coins*`, { parse_mode:'Markdown', ...backToMainKeyboard() }).catch(()=>{});
}

module.exports = { handleGetOtp, handleServicePage, handleSearchOtp, handleSelectService, handleConfirmOtp, handleCheckOtp, handleCancelOtp };
