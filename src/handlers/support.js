const { getSetting } = require('../models/Settings');
const User = require('../models/User');
const OtpOrder = require('../models/OtpOrder');
const DepositRequest = require('../models/DepositRequest');
const { Markup } = require('telegraf');
const { backToMainKeyboard } = require('../utils/keyboards');
const { formatCoins } = require('../utils/helpers');

async function handleSupport(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const sup = await getSetting('support_username');
  await ctx.editMessageText(
    `🆘 *Support*\n\n📩 Contact: ${sup}\n\n*Common Issues:*\n• Deposit not credited → Share UTR + screenshot\n• OTP not received → Contact within 10 min\n• Account issues → Share your User ID\n\n🆔 Your ID: \`${ctx.from.id}\``,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.url('📩 Contact',`https://t.me/${sup.replace('@','')}`)],...[[Markup.button.callback('🔙 Back','menu:main')]]]) }
  ).catch(() => ctx.reply(`🆘 Support: ${sup}\n\nID: \`${ctx.from.id}\``, { parse_mode:'Markdown' }));
}

async function handleStatus(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const [totalUsers, totalOrders, totalBought, pendingDeps] = await Promise.all([
    User.count(), OtpOrder.count(),
    OtpOrder.count({ where:{ status:'received' } }),
    DepositRequest.count({ where:{ status:'pending' } }),
  ]);
  const since = new Date(); since.setHours(0,0,0,0);
  const { Op } = require('sequelize');
  const [todayUsers, todayOrders, activeOrders] = await Promise.all([
    User.count({ where:{ createdAt:{ [Op.gte]: since } } }),
    OtpOrder.count({ where:{ createdAt:{ [Op.gte]: since } } }),
    OtpOrder.count({ where:{ status:'waiting' } }),
  ]);
  await ctx.editMessageText(
    `📊 *OtpX Statistics*\n\n👥 Total Users: *${formatCoins(totalUsers)}*\n📦 Total Orders: *${formatCoins(totalOrders)}*\n✅ OTPs Delivered: *${formatCoins(totalBought)}*\n⏳ Active Orders: *${activeOrders}*\n💰 Pending Deposits: *${pendingDeps}*\n\n📅 Today:\n👤 New Users: ${todayUsers}\n📦 Orders: ${todayOrders}\n\n🤖 Status: ✅ Online | 🔥 Services: 4000+`,
    { parse_mode:'Markdown', ...backToMainKeyboard() }
  ).catch(() => ctx.reply(`📊 Users: ${totalUsers} | Orders: ${totalOrders} | Delivered: ${totalBought}`, backToMainKeyboard()));
}

module.exports = { handleSupport, handleStatus };
