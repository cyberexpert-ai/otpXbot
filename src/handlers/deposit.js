const User = require('../models/User');
const DepositRequest = require('../models/DepositRequest');
const Transaction = require('../models/Transaction');
const { getSetting } = require('../models/Settings');
const { Markup } = require('telegraf');
const { ADMIN_IDS } = require('../config');
const { depositApproveKeyboard, backToMainKeyboard } = require('../utils/keyboards');
const { formatDate } = require('../utils/helpers');

const depositState = new Map();

async function handleDeposit(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user || user.isBanned) return;
  const [coinPrice, minDep, maxDep] = await Promise.all([getSetting('coin_price'), getSetting('min_deposit'), getSetting('max_deposit')]);
  await ctx.editMessageText(
    `💰 *Deposit Coins*\n\n📊 Rate: 1 coin = ₹${coinPrice}\n📥 Min: ₹${minDep} | 📤 Max: ₹${maxDep}\n💎 Balance: *${user.balance} coins*\n\nEnter how many coins to deposit:`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','menu:main')]]) }
  ).catch(() => ctx.reply(`💰 *Deposit*\n\nEnter coins amount:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','menu:main')]]) }));
  depositState.set(ctx.from.id, { step:'awaiting_coins' });
}

async function handleDepositInput(ctx) {
  const userId = ctx.from.id;
  const state = depositState.get(userId);
  if (!state) return false;
  const text = ctx.message.text?.trim();

  if (state.step === 'awaiting_coins') {
    const coins = parseInt(text);
    if (isNaN(coins) || coins <= 0) { await ctx.reply('❌ Enter a valid number.'); return true; }
    const [coinPrice, minDep, maxDep] = await Promise.all([getSetting('coin_price'), getSetting('min_deposit'), getSetting('max_deposit')]);
    const amountInr = coins * coinPrice;
    if (amountInr < minDep) { await ctx.reply(`❌ Minimum ₹${minDep} (${Math.floor(minDep/coinPrice)} coins).`); return true; }
    if (amountInr > maxDep) { await ctx.reply(`❌ Maximum ₹${maxDep} (${Math.floor(maxDep/coinPrice)} coins).`); return true; }
    state.step = 'show_upi'; state.coins = coins; state.amountInr = amountInr;
    depositState.set(userId, state);
    await showUpiPayment(ctx, coins, amountInr);
    return true;
  }
  if (state.step === 'awaiting_utr') {
    state.utr = text; state.step = 'awaiting_screenshot';
    depositState.set(userId, state);
    await ctx.reply(`✅ UTR: \`${text}\`\n\n📸 Now send screenshot of payment:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','deposit:cancel')]]) });
    return true;
  }
  return false;
}

async function handleDepositPhoto(ctx) {
  const userId = ctx.from.id;
  const state = depositState.get(userId);
  if (!state || state.step !== 'awaiting_screenshot') return false;
  const photo = ctx.message.photo;
  if (!photo?.length) return false;
  const fileId = photo[photo.length - 1].file_id;
  depositState.delete(userId);

  const request = await DepositRequest.create({ userId, coins:state.coins, amountInr:state.amountInr, utr:state.utr||'Not provided', screenshotFileId:fileId, status:'pending' });

  await ctx.reply(`✅ *Payment Submitted!*\n\n🔢 ID: \`${request.id}\`\n💰 Coins: *${state.coins}*\n💵 Amount: ₹${state.amountInr}\n\n⏳ Pending review (15-30 min).`, { parse_mode:'Markdown', ...backToMainKeyboard() });

  for (const adminId of ADMIN_IDS) {
    await ctx.telegram.sendPhoto(adminId, fileId, {
      caption: `💰 *New Deposit*\n\n👤 ${ctx.from.first_name} (@${ctx.from.username||'N/A'})\n🆔 \`${userId}\`\n💎 Coins: *${state.coins}*\n💵 ₹${state.amountInr}\n🧾 UTR: \`${state.utr||'N/A'}\`\n📄 ID: \`${request.id}\``,
      parse_mode:'Markdown', ...depositApproveKeyboard(request.id, userId, state.coins),
    }).catch(() => ctx.telegram.sendMessage(adminId, `💰 New Deposit\n👤 ${ctx.from.first_name}\n🆔 ${userId}\n💎 ${state.coins} coins\n💵 ₹${state.amountInr}\n📄 ${request.id}`, { parse_mode:'Markdown', ...depositApproveKeyboard(request.id, userId, state.coins) }).catch(()=>{}));
  }
  return true;
}

async function showUpiPayment(ctx, coins, amountInr) {
  const [upiId, upiName] = await Promise.all([getSetting('upi_id'), getSetting('upi_name')]);
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amountInr}&cu=INR&tn=OtpX+Deposit`;
  await ctx.reply(
    `📲 *Make Payment*\n\n💵 Amount: *₹${amountInr}*\n💎 Coins: *${coins}*\n\n🏦 *UPI Details:*\n👤 Name: \`${upiName}\`\n📱 UPI ID: \`${upiId}\`\n\n⚠️ Pay exact: ₹${amountInr} — save your UTR!`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.url('💳 Pay Now', upiLink)],
      [Markup.button.copy_text('📋 Copy UPI ID', upiId)],
      [Markup.button.callback('✅ I Have Paid','deposit:paid')],
      [Markup.button.callback('❌ Cancel','deposit:cancel')],
    ])}
  );
}

async function handleDepositPaid(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const state = depositState.get(ctx.from.id) || {};
  if (!state.coins) return ctx.reply('❌ No active deposit. Start again.', backToMainKeyboard());
  state.step = 'awaiting_utr';
  depositState.set(ctx.from.id, state);
  await ctx.reply(`🧾 *Enter UTR / Transaction ID:*`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','deposit:cancel')]]) });
}

async function handleDepositCancel(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  depositState.delete(ctx.from.id);
  await ctx.editMessageText('❌ Deposit cancelled.', backToMainKeyboard()).catch(() => ctx.reply('❌ Deposit cancelled.', backToMainKeyboard()));
}

async function handleApproveDeposit(ctx, depositId) {
  await ctx.answerCbQuery('Processing...').catch(() => {});
  const request = await DepositRequest.findOne({ where: { id: depositId } });
  if (!request) return ctx.answerCbQuery('❌ Not found', { show_alert:true });
  if (request.status !== 'pending') return ctx.answerCbQuery(`Already ${request.status}`, { show_alert:true });
  const user = await User.findOne({ where: { telegramId: request.userId } });
  if (!user) return ctx.answerCbQuery('❌ User not found', { show_alert:true });
  const balBefore = user.balance;
  await user.addBalance(request.coins);
  user.totalDeposited += request.coins;
  await user.save();
  await DepositRequest.update({ status:'approved', adminId:ctx.from.id, processedAt:new Date() }, { where:{ id:depositId } });
  await Transaction.create({ userId:Number(request.userId), type:'deposit', amount:request.coins, description:'Deposit approved', status:'completed', balanceBefore:balBefore, balanceAfter:user.balance, metadata:{ depositId:request.id } });
  await ctx.telegram.sendMessage(Number(request.userId), `✅ *Deposit Approved!*\n\n💎 *${request.coins} coins* added!\n💵 ₹${request.amountInr}\n💰 New Balance: *${user.balance} coins* 🎉`, { parse_mode:'Markdown', ...backToMainKeyboard() }).catch(()=>{});
  await ctx.editMessageCaption(`✅ *APPROVED* by ${ctx.from.first_name}\n\n${ctx.callbackQuery?.message?.caption||''}`, { parse_mode:'Markdown' }).catch(() => ctx.reply(`✅ Deposit ${depositId} approved.`));
}

async function handleRejectDeposit(ctx, depositId) {
  await ctx.answerCbQuery().catch(() => {});
  const request = await DepositRequest.findOne({ where: { id: depositId } });
  if (!request) return ctx.answerCbQuery('❌ Not found', { show_alert:true });
  if (request.status !== 'pending') return ctx.answerCbQuery(`Already ${request.status}`, { show_alert:true });
  await DepositRequest.update({ status:'rejected', adminId:ctx.from.id, processedAt:new Date() }, { where:{ id:depositId } });
  await ctx.telegram.sendMessage(Number(request.userId), `❌ *Deposit Rejected*\n\n💎 ${request.coins} coins | ₹${request.amountInr}\n\nContact support if this is an error.`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🆘 Support','menu:support')]]) }).catch(()=>{});
  await ctx.editMessageCaption(`❌ *REJECTED* by ${ctx.from.first_name}`, { parse_mode:'Markdown' }).catch(() => ctx.reply(`❌ Deposit ${depositId} rejected.`));
}

module.exports = { handleDeposit, handleDepositInput, handleDepositPhoto, handleDepositPaid, handleDepositCancel, handleApproveDeposit, handleRejectDeposit, depositState };
