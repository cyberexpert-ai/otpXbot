const { Op } = require('sequelize');
const User = require('../models/User');
const OtpOrder = require('../models/OtpOrder');
const GiftCode = require('../models/GiftCode');
const Transaction = require('../models/Transaction');
const { getSetting } = require('../models/Settings');
const { profileKeyboard, backToProfileKeyboard, backToMainKeyboard, historyKeyboard } = require('../utils/keyboards');
const { formatCoins, formatDate, timeAgo } = require('../utils/helpers');
const { Markup } = require('telegraf');

const giftCodeState = new Map();

async function handleProfile(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) return;
  await ctx.editMessageText(
    `👤 *Your Profile*\n\n🆔 ID: \`${user.telegramId}\`\n👋 ${user.firstName||''} ${user.lastName||''}\n💎 Balance: *${formatCoins(user.balance)} coins*\n📦 Orders: *${user.totalOrders}*\n💸 Deposited: *${formatCoins(user.totalDeposited)}*\n🔗 Referrals: *${user.referralCount}*\n${user.isVip?'⭐ VIP Member\n':''}\n📅 Joined: ${formatDate(user.joinedAt)}`,
    { parse_mode:'Markdown', ...profileKeyboard() }
  ).catch(() => ctx.reply(`👤 Balance: ${user.balance} coins`, { parse_mode:'Markdown', ...profileKeyboard() }));
}

async function handleBalance(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) return;
  const txns = await Transaction.findAll({ where: { userId: ctx.from.id }, order:[['createdAt','DESC']], limit:5 });
  let txnText = txns.length ? '\n\n📋 *Recent Transactions:*\n' + txns.map(t=>`${t.amount>0?'🟢':'🔴'} ${t.amount>0?'+':''}${t.amount} — ${t.description||t.type} — ${timeAgo(t.createdAt)}`).join('\n') : '';
  await ctx.editMessageText(
    `💎 *My Balance*\n\n💰 Balance: *${formatCoins(user.balance)} coins*\n📈 Deposited: *${formatCoins(user.totalDeposited)}*\n📉 Spent: *${formatCoins(user.totalSpent)}*\n🎁 Referral Earned: *${formatCoins(user.referralEarned)}*${txnText}`,
    { parse_mode:'Markdown', ...backToProfileKeyboard() }
  ).catch(()=>{});
}

async function handleRefer(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) return;
  const [perRefer, referEnabled] = await Promise.all([getSetting('per_refer_coins'), getSetting('referral_enabled')]);
  const link = `https://t.me/${ctx.botInfo.username}?start=ref_${user.referralCode}`;
  await ctx.editMessageText(
    `🔗 *Referral System*\n\n${referEnabled?'✅ Active':'❌ Disabled'}\n\n💰 Per Refer: *${perRefer} coins*\n👥 Your Referrals: *${user.referralCount}*\n🎁 Earned: *${formatCoins(user.referralEarned)} coins*\n\n🔗 *Your Link:*\n\`${link}\``,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.url('📤 Share', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join OtpX - OTPs for 4000+ services!')}`)],
      [Markup.button.copy_text('📋 Copy Link', link)],
      [Markup.button.callback('🔙 Back','menu:profile')],
    ])}
  ).catch(()=>{});
}

async function handleHistory(ctx, page=0) {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const pageSize = 8;
  const total = await OtpOrder.count({ where: { userId } });
  const totalPages = Math.ceil(total/pageSize)||1;
  const pg = Math.min(parseInt(page), totalPages-1);
  const orders = await OtpOrder.findAll({ where:{ userId }, order:[['createdAt','DESC']], offset:pg*pageSize, limit:pageSize });
  if (!orders.length) {
    return ctx.editMessageText(`📜 *Order History*\n\nNo orders yet. Use *🎯 Get OTP* to start!`, { parse_mode:'Markdown', ...backToProfileKeyboard() }).catch(()=>{});
  }
  const emoji = { received:'✅',cancelled:'❌',expired:'⏰',waiting:'⏳' };
  let text = `📜 *History* (${total} total)\n\n`;
  for (const o of orders) {
    text += `${emoji[o.status]||'❓'} *${o.service}*\n   📞 ${o.phoneNumber?`+91${o.phoneNumber}`:'N/A'} | 💰 ${o.coinsCharged}c | ${timeAgo(o.createdAt)}\n\n`;
  }
  await ctx.editMessageText(text, { parse_mode:'Markdown', ...historyKeyboard(orders, pg, totalPages) }).catch(()=>{});
}

async function handleHistoryDetail(ctx, orderId) {
  await ctx.answerCbQuery().catch(() => {});
  const order = await OtpOrder.findOne({ where: { id:orderId } });
  if (!order) return ctx.answerCbQuery('Not found', { show_alert:true });
  if (Number(order.userId) !== ctx.from.id) return ctx.answerCbQuery('Access denied', { show_alert:true });
  const emoji = { received:'✅',cancelled:'❌',expired:'⏰',waiting:'⏳' };
  await ctx.editMessageText(
    `📦 *Order Details*\n\n📱 ${order.service}\n📞 \`${order.phoneNumber?`+91${order.phoneNumber}`:'N/A'}\`\n${order.otp?`🔑 OTP: \`${order.otp}\`\n`:''}${order.smsText?`📩 SMS: _${order.smsText}_\n`:''}\n📊 Status: ${emoji[order.status]||''} *${order.status.toUpperCase()}*\n💰 Charged: *${order.coinsCharged} coins*\n🕐 ${formatDate(order.createdAt)}`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','profile:history:0')]]) }
  ).catch(()=>{});
}

async function handleGiftCode(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  giftCodeState.set(ctx.from.id, true);
  await ctx.editMessageText(
    `🎁 *Gift Code*\n\nEnter your gift code to claim free coins!\n\nExample: \`OTPX-ABCDEFGHIJ\``,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','menu:profile')]]) }
  ).catch(()=>{});
}

async function handleGiftCodeInput(ctx) {
  const userId = ctx.from.id;
  if (!giftCodeState.get(userId)) return false;
  giftCodeState.delete(userId);
  const code = ctx.message.text?.trim().toUpperCase();
  const user = await User.findOne({ where: { telegramId: userId } });
  if (!user) return true;
  if (!await getSetting('gift_code_enabled')) { await ctx.reply('❌ Gift codes disabled.', backToMainKeyboard()); return true; }
  const gc = await GiftCode.findOne({ where: { code } });
  if (!gc) { await ctx.reply('❌ Invalid gift code.', { ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','menu:profile')]]) }); return true; }
  const check = gc.canClaim(userId, user.totalDeposited);
  if (!check.ok) { await ctx.reply(check.msg, { ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','menu:profile')]]) }); return true; }
  gc.usedCount += 1;
  const usedBy = gc.usedBy || [];
  usedBy.push(userId);
  gc.usedBy = usedBy;
  await gc.save();
  const balBefore = user.balance;
  await user.addBalance(gc.coinsValue);
  await Transaction.create({ userId, type:'gift_code', amount:gc.coinsValue, description:`Gift code: ${code}`, balanceBefore:balBefore, balanceAfter:user.balance });
  await ctx.reply(`🎉 *Gift Code Claimed!*\n\n🎁 Code: \`${code}\`\n💎 +${gc.coinsValue} coins!\n💰 Balance: *${user.balance} coins*`, { parse_mode:'Markdown', ...backToMainKeyboard() });
  return true;
}

module.exports = { handleProfile, handleBalance, handleRefer, handleHistory, handleHistoryDetail, handleGiftCode, handleGiftCodeInput, giftCodeState };
