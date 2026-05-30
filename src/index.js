require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { connectDB } = require('./database');
const { initSettings } = require('./models/Settings');
const { createServer } = require('./server');
const { BOT_TOKEN, WEBHOOK_URL, PORT } = require('./config');

const { handleStart, handleJoinedCheck, handleWebAppData, sendMainMenu } = require('./handlers/start');
const { handleGetOtp, handleServicePage, handleSearchOtp, handleSelectService, handleConfirmOtp, handleCheckOtp, handleCancelOtp } = require('./handlers/getOtp');
const { handleDeposit, handleDepositInput, handleDepositPhoto, handleDepositPaid, handleDepositCancel, handleApproveDeposit, handleRejectDeposit, depositState } = require('./handlers/deposit');
const { handleProfile, handleBalance, handleRefer, handleHistory, handleHistoryDetail, handleGiftCode, handleGiftCodeInput, giftCodeState } = require('./handlers/profile');
const { handleSupport, handleStatus } = require('./handlers/support');
const {
  handleAdmin, handleAdminSettings, handleSetSetting, handleToggleSetting,
  handleAdminMaintenance, handleAdminUsers, handleAdminUserSearch, handleViewUser,
  handleAddBalance, handleDeductBalance, handleBanUser, handleUnbanUser, handleMakeVip,
  handleAdminDeposits, handleAdminDepositList, handleAdminOrders,
  handleAdminGiftCodes, handleCreateGiftCode, handleListGiftCodes,
  handleAdminBroadcast, handleBroadcastTarget,
  handleAdminAnalytics, handleAdminFinancial, handleAdminSecurity,
  handleAdminBotConfig, handleAdminOtpSettings, handleAdminRefunds,
  handleAdminChannels, handleAdminAnnounce, handleAdminLogs,
  handleAdminSmsApi, handleAdminGemini, handleAdminInput,
} = require('./handlers/admin');

const User = require('./models/User');
const OtpOrder = require('./models/OtpOrder');
const { isAdmin } = require('./utils/helpers');
const { mainMenuKeyboard } = require('./utils/keyboards');
const { getSetting } = require('./models/Settings');

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN missing!'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ── Update lastActive ──
bot.use(async (ctx, next) => {
  if (ctx.from?.id) {
    User.update({ lastActive: new Date() }, { where: { telegramId: ctx.from.id } }).catch(() => {});
  }
  return next();
});

bot.start(handleStart);

bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
  await handleAdmin(ctx);
});

bot.command('menu', async (ctx) => {
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user || !user.isVerified) return ctx.reply('Please /start first.');
  if (user.isBanned) return ctx.reply('🚫 Banned.');
  await sendMainMenu(ctx, user);
});

bot.command('balance', async (ctx) => {
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) return ctx.reply('Please /start first.');
  await ctx.reply(`💎 Balance: *${user.balance} coins*`, { parse_mode:'Markdown', ...mainMenuKeyboard() });
});

bot.command('refer', async (ctx) => {
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  if (!user) return ctx.reply('Please /start first.');
  const link = `https://t.me/${ctx.botInfo.username}?start=ref_${user.referralCode}`;
  await ctx.reply(`🔗 Your link:\n\`${link}\``, { parse_mode:'Markdown' });
});

// ─── CALLBACKS ──────────────────────────────────────────
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  try {
    if (data === 'noop') return ctx.answerCbQuery().catch(()=>{});
    if (data === 'check:joined') return handleJoinedCheck(ctx);
    if (data === 'start:retry') return handleStart(ctx);

    // Main menu
    if (data === 'menu:main') {
      await ctx.answerCbQuery().catch(()=>{});
      const user = await User.findOne({ where: { telegramId: ctx.from.id } });
      if (!user || !user.isVerified) return ctx.reply('Please /start first.');
      if (user.isBanned) return ctx.reply('🚫 Banned.');
      const w = await getSetting('welcome_message');
      await ctx.editMessageText(`${w}\n\n👋 *${user.firstName||'User'}*\n💎 Balance: *${user.balance} coins*`,
        { parse_mode:'Markdown', ...mainMenuKeyboard() }
      ).catch(() => ctx.reply(`👋 *${user.firstName||'User'}*\n💎 *${user.balance} coins*`, { parse_mode:'Markdown', ...mainMenuKeyboard() }));
      return;
    }

    if (data === 'menu:getotp')   return handleGetOtp(ctx);
    if (data === 'menu:deposit')  return handleDeposit(ctx);
    if (data === 'menu:profile')  return handleProfile(ctx);
    if (data === 'menu:support')  return handleSupport(ctx);
    if (data === 'menu:status')   return handleStatus(ctx);

    // OTP
    if (data.startsWith('otp:page:'))    { const p=data.split(':'); return handleServicePage(ctx, p[2]||0, p[3]||''); }
    if (data === 'otp:search')           return handleSearchOtp(ctx);
    if (data.startsWith('otp:select:'))  { const p=data.split(':'); return handleSelectService(ctx, p[2], p[3]||0); }
    if (data.startsWith('otp:confirm:')) return handleConfirmOtp(ctx, data.split(':')[2]);
    if (data.startsWith('otp:check:'))   return handleCheckOtp(ctx, data.split(':')[2]);
    if (data.startsWith('otp:cancel:'))  return handleCancelOtp(ctx, data.split(':')[2]);

    // Deposit
    if (data === 'deposit:paid' || data === 'deposit:submit') return handleDepositPaid(ctx);
    if (data === 'deposit:cancel') return handleDepositCancel(ctx);

    // Profile
    if (data === 'profile:main')    return handleProfile(ctx);
    if (data === 'profile:balance') return handleBalance(ctx);
    if (data === 'profile:refer')   return handleRefer(ctx);
    if (data === 'profile:giftcode') return handleGiftCode(ctx);
    if (data.startsWith('profile:history:')) return handleHistory(ctx, data.split(':')[2]||0);
    if (data.startsWith('history:detail:'))  return handleHistoryDetail(ctx, data.split(':')[2]);

    // Admin deposit actions
    if (data.startsWith('admin:deposit:approve:')) return handleApproveDeposit(ctx, data.split(':')[3]);
    if (data.startsWith('admin:deposit:reject:'))  return handleRejectDeposit(ctx, data.split(':')[3]);

    // Admin main sections
    if (data === 'admin:main')        return handleAdmin(ctx);
    if (data === 'admin:settings')    return handleAdminSettings(ctx);
    if (data === 'admin:users')       return handleAdminUsers(ctx);
    if (data === 'admin:deposits')    return handleAdminDeposits(ctx);
    if (data === 'admin:orders')      return handleAdminOrders(ctx);
    if (data === 'admin:giftcodes')   return handleAdminGiftCodes(ctx);
    if (data === 'admin:broadcast')   return handleAdminBroadcast(ctx);
    if (data === 'admin:analytics')   return handleAdminAnalytics(ctx);
    if (data === 'admin:security')    return handleAdminSecurity(ctx);
    if (data === 'admin:financial')   return handleAdminFinancial(ctx);
    if (data === 'admin:smsapi')      return handleAdminSmsApi(ctx);
    if (data === 'admin:gemini')      return handleAdminGemini(ctx);
    if (data === 'admin:botconfig')   return handleAdminBotConfig(ctx);
    if (data === 'admin:maintenance') return handleAdminMaintenance(ctx);
    if (data === 'admin:logs')        return handleAdminLogs(ctx);
    if (data === 'admin:otpsettings') return handleAdminOtpSettings(ctx);
    if (data === 'admin:refunds')     return handleAdminRefunds(ctx);
    if (data === 'admin:channels')    return handleAdminChannels(ctx);
    if (data === 'admin:announce')    return handleAdminAnnounce(ctx);

    if (data.startsWith('admin:set:'))    return handleSetSetting(ctx, data.replace('admin:set:',''));
    if (data.startsWith('admin:toggle:')) return handleToggleSetting(ctx, data.replace('admin:toggle:',''));

    if (data === 'admin:user:search')             return handleAdminUserSearch(ctx);
    if (data.startsWith('admin:user:view:'))      return handleViewUser(ctx, data.split(':')[3]);
    if (data.startsWith('admin:user:addbal:'))    return handleAddBalance(ctx, data.split(':')[3]);
    if (data.startsWith('admin:user:deductbal:')) return handleDeductBalance(ctx, data.split(':')[3]);
    if (data.startsWith('admin:user:ban:'))       return handleBanUser(ctx, data.split(':')[3]);
    if (data.startsWith('admin:user:unban:'))     return handleUnbanUser(ctx, data.split(':')[3]);
    if (data.startsWith('admin:user:vip:'))       return handleMakeVip(ctx, data.split(':')[3]);
    if (data.startsWith('admin:user:history:'))   return handleAdminUserHistory(ctx, data.split(':')[3]);
    if (data === 'admin:user:recent')             return handleAdminUserList(ctx,'recent');
    if (data === 'admin:user:banned')             return handleAdminUserList(ctx,'banned');
    if (data === 'admin:user:vip_list')           return handleAdminUserList(ctx,'vip');
    if (data === 'admin:user:topspend')           return handleAdminUserList(ctx,'topspend');
    if (data === 'admin:user:newtoday')           return handleAdminUserList(ctx,'newtoday');
    if (data === 'admin:user:richlist')           return handleAdminUserList(ctx,'richlist');

    if (data.startsWith('admin:deposits:')) { const p=data.split(':'); return handleAdminDepositList(ctx, p[2], p[3]||0); }
    if (data === 'admin:giftcode:create')         return handleCreateGiftCode(ctx);
    if (data.startsWith('admin:giftcode:list:'))  return handleListGiftCodes(ctx, data.split(':')[3]);
    if (data.startsWith('admin:broadcast:'))      return handleBroadcastTarget(ctx, data.split(':')[2]);

    if (data.startsWith('admin:orders:')) {
      await ctx.answerCbQuery().catch(()=>{});
      const { Op } = require('sequelize');
      const sub=data.split(':')[2];
      let where={};
      if (sub==='waiting') where.status='waiting';
      else if (sub==='received') where.status='received';
      else if (sub==='failed') where.status={[Op.in]:['cancelled','expired']};
      else if (sub==='today') { const s=new Date(); s.setHours(0,0,0,0); where.createdAt={[Op.gte]:s}; }
      const orders=await OtpOrder.findAll({where, order:[['createdAt','DESC']], limit:15});
      const text=orders.length?orders.map(o=>`• *${o.service}* | +91${o.phoneNumber||'?'} | ${o.status}`).join('\n'):'No orders found.';
      return ctx.editMessageText(`📦 *Orders (${sub})*\n\n${text}`,{parse_mode:'Markdown',reply_markup:{inline_keyboard:[[{text:'🔙 Back',callback_data:'admin:orders'}]]}}).catch(()=>{});
    }

    if (data === 'admin:refund:all') {
      await ctx.answerCbQuery('Processing...').catch(()=>{});
      const { Op } = require('sequelize');
      const expired=await OtpOrder.findAll({where:{status:'expired',refunded:false}});
      let cnt=0;
      for (const o of expired) {
        const user=await User.findOne({where:{telegramId:o.userId}});
        if (user) { await user.addBalance(o.coinsCharged); cnt++; }
        await OtpOrder.update({refunded:true},{where:{id:o.id}});
      }
      return ctx.reply(`✅ Processed *${cnt}* refunds.`,{parse_mode:'Markdown',...backToMainKeyboard()});
    }

    if (data === 'admin:smsapi:refresh') {
      await ctx.answerCbQuery('Refreshing...').catch(()=>{});
      const { refreshAvailableNumbers } = require('./utils/firebaseSms');
      const nums = await refreshAvailableNumbers();
      return ctx.answerCbQuery(`✅ Found ${nums.length} numbers`, { show_alert:true });
    }

    await ctx.answerCbQuery().catch(()=>{});
  } catch(err) {
    console.error('CB error:', err.message);
    ctx.answerCbQuery('❌ Error').catch(()=>{});
  }
});

// ── Helper functions ──
async function handleAdminUserHistory(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  const uid=parseInt(userId);
  const orders=await OtpOrder.findAll({where:{userId:uid},order:[['createdAt','DESC']],limit:10});
  const text=orders.length?orders.map(o=>`• *${o.service}* | ${o.status} | ${o.coinsCharged}c`).join('\n'):'No orders.';
  await ctx.editMessageText(`📜 Orders for \`${uid}\`:\n\n${text}`,{parse_mode:'Markdown',reply_markup:{inline_keyboard:[[{text:'🔙 Back',callback_data:`admin:user:view:${uid}`}]]}}).catch(()=>{});
}

const { Op } = require('sequelize');
async function handleAdminUserList(ctx, type) {
  await ctx.answerCbQuery().catch(()=>{});
  let where={}, order=[['createdAt','DESC']], limit=12;
  if (type==='banned')   { where.isBanned=true; }
  else if (type==='vip') { where.isVip=true; }
  else if (type==='topspend') { order=[['totalSpent','DESC']]; }
  else if (type==='newtoday') { const s=new Date(); s.setHours(0,0,0,0); where.createdAt={[Op.gte]:s}; }
  else if (type==='richlist')  { order=[['balance','DESC']]; }
  const users=await User.findAll({where,order,limit});
  if (!users.length) return ctx.editMessageText('No users found.',{reply_markup:{inline_keyboard:[[{text:'🔙 Back',callback_data:'admin:users'}]]}}).catch(()=>{});
  const text=users.map(u=>`👤 \`${u.telegramId}\` ${u.firstName||'?'} | 💎${u.balance}c${u.isBanned?' 🚫':u.isVip?' ⭐':''}`).join('\n');
  await ctx.editMessageText(`👥 *Users (${type})*\n\n${text}`,{parse_mode:'Markdown',reply_markup:{inline_keyboard:[[{text:'🔙 Back',callback_data:'admin:users'}]]}}).catch(()=>{});
}

const { backToMainKeyboard } = require('./utils/keyboards');

// ── WebApp ──
bot.on('web_app_data', handleWebAppData);

// ── Messages ──
bot.on('message', async (ctx) => {
  if (!ctx.message?.text && !ctx.message?.photo) return;
  const userId = ctx.from.id;
  const text = ctx.message?.text || '';

  if (ctx.message?.photo) {
    const h = await handleDepositPhoto(ctx).catch(()=>false);
    if (h) return;
  }
  if (!text) return;

  if (isAdmin(userId)) {
    const h = await handleAdminInput(ctx).catch(()=>false);
    if (h) return;
  }

  if (ctx.session?.awaitingOtpSearch) {
    ctx.session.awaitingOtpSearch = false;
    const { getServicePage } = require('./utils/services');
    const { servicesKeyboard } = require('./utils/keyboards');
    const { items } = getServicePage(0, 8, text);
    if (!items.length) return ctx.reply(`❌ No services for "*${text}*"`, { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[{text:'🔙 Back',callback_data:'menu:getotp'}]] }});
    return ctx.reply(`🔍 Results for "*${text}*":`, { parse_mode:'Markdown', ...servicesKeyboard(0, text) });
  }

  if (depositState.get(userId)) {
    const h = await handleDepositInput(ctx).catch(()=>false);
    if (h) return;
  }

  if (giftCodeState.get(userId)) {
    const h = await handleGiftCodeInput(ctx).catch(()=>false);
    if (h) return;
  }

  if (text.startsWith('/')) return;
  const user = await User.findOne({ where: { telegramId: userId } });
  if (user && user.isVerified && !user.isBanned) {
    await ctx.reply(`💎 Balance: *${user.balance} coins*\n\nChoose an option:`, { parse_mode:'Markdown', ...mainMenuKeyboard() });
  }
});

bot.catch((err, ctx) => {
  console.error('Bot error:', err.message);
  ctx?.reply?.('❌ Error. Please try again.').catch(()=>{});
});

async function main() {
  await connectDB();
  await initSettings();
  console.log('✅ DB ready');

  const app = createServer(bot);

  if (WEBHOOK_URL) {
    const wp = `/webhook/${BOT_TOKEN}`;
    await bot.telegram.setWebhook(`${WEBHOOK_URL}${wp}`);
    console.log('✅ Webhook set:', WEBHOOK_URL + wp);
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port ${PORT}`));
  } else {
    await bot.telegram.deleteWebhook();
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port ${PORT}`));
    await bot.launch();
    console.log('✅ Polling mode');
  }

  if (WEBHOOK_URL) {
    setInterval(() => require('axios').get(WEBHOOK_URL+'/health',{timeout:5000}).catch(()=>{}), 10*60*1000);
    // Webhook mode — graceful shutdown without bot.stop()
    process.once('SIGINT', () => { console.log('SIGINT received'); process.exit(0); });
    process.once('SIGTERM', () => { console.log('SIGTERM received'); process.exit(0); });
  } else {
    // Polling mode — stop bot properly
    process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch {} });
    process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch {} });
  }
}

main().catch(err => { console.error('Startup error:', err); process.exit(1); });
