const { Op } = require('sequelize');
const User = require('../models/User');
const OtpOrder = require('../models/OtpOrder');
const DepositRequest = require('../models/DepositRequest');
const GiftCode = require('../models/GiftCode');
const Transaction = require('../models/Transaction');
const { getSetting, setSetting, getAllSettings } = require('../models/Settings');
const { isAdmin, formatCoins, formatDate, generateGiftCode, sleep } = require('../utils/helpers');
const { testGeminiKey } = require('../utils/gemini');
const { adminMainKeyboard, adminSettingsKeyboard, adminDepositsKeyboard, adminGiftCodesKeyboard, backToMainKeyboard, userManageKeyboard } = require('../utils/keyboards');
const { Markup } = require('telegraf');

const adminState = new Map();
const setAdminState = (id, s) => adminState.set(id, s);
const getAdminState = (id) => adminState.get(id) || null;
const clearAdminState = (id) => adminState.delete(id);

// ═══════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════
async function handleAdmin(ctx) {
  if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Access denied.');
  const [u, o, pd, ao, banned] = await Promise.all([
    User.count(), OtpOrder.count(),
    DepositRequest.count({ where:{status:'pending'} }),
    OtpOrder.count({ where:{status:'waiting'} }),
    User.count({ where:{isBanned:true} }),
  ]);
  const since = new Date(); since.setHours(0,0,0,0);
  const todayU = await User.count({ where:{ createdAt:{[Op.gte]:since} } });
  const todayO = await OtpOrder.count({ where:{ createdAt:{[Op.gte]:since} } });
  const maintenance = await getSetting('maintenance_mode');

  const msg = `🛡️ *OtpX Admin Panel*\n\n` +
    `${maintenance ? '🔴 *MAINTENANCE MODE ON*\n\n' : ''}` +
    `👥 Users: *${formatCoins(u)}* (+${todayU} today)\n` +
    `📦 Orders: *${formatCoins(o)}* (+${todayO} today)\n` +
    `⏳ Active Orders: *${ao}*\n` +
    `💰 Pending Deposits: *${pd}*\n` +
    `🚫 Banned: *${banned}*`;

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('⚙️ Settings','admin:settings'), Markup.button.callback('👥 Users','admin:users')],
    [Markup.button.callback('💰 Deposits','admin:deposits'), Markup.button.callback('📦 Orders','admin:orders')],
    [Markup.button.callback('🎁 Gift Codes','admin:giftcodes'), Markup.button.callback('📢 Broadcast','admin:broadcast')],
    [Markup.button.callback('📊 Analytics','admin:analytics'), Markup.button.callback('💳 Financial','admin:financial')],
    [Markup.button.callback('🔒 Security','admin:security'), Markup.button.callback('🤖 Bot Config','admin:botconfig')],
    [Markup.button.callback('🤖 Gemini AI','admin:gemini'), Markup.button.callback('📱 SMS API','admin:smsapi')],
    [Markup.button.callback('🔧 Maintenance','admin:maintenance'), Markup.button.callback('📋 Logs','admin:logs')],
    [Markup.button.callback('🎯 OTP Settings','admin:otpsettings'), Markup.button.callback('💸 Refunds','admin:refunds')],
    [Markup.button.callback('🌐 Channels','admin:channels'), Markup.button.callback('📣 Announcements','admin:announce')],
  ]);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(()=>{});
    await ctx.editMessageText(msg, { parse_mode:'Markdown', ...kb }).catch(() => ctx.reply(msg, { parse_mode:'Markdown', ...kb }));
  } else {
    await ctx.reply(msg, { parse_mode:'Markdown', ...kb });
  }
}

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════
async function handleAdminSettings(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const s = await getAllSettings();
  await ctx.editMessageText(
    `⚙️ *Bot Settings*\n\n` +
    `💰 Coin Price: *₹${s.coin_price}*\n` +
    `📥 Min Deposit: *₹${s.min_deposit}*\n` +
    `📤 Max Deposit: *₹${s.max_deposit}*\n` +
    `🔗 Per Refer: *${s.per_refer_coins} coins*\n` +
    `🎁 New User Bonus: *${s.new_user_bonus} coins*\n` +
    `🎯 OTP Cost: *${s.otp_cost} coins*\n` +
    `⏱️ Max OTP Wait: *${s.max_otp_wait}s*\n` +
    `📲 UPI ID: \`${s.upi_id}\`\n` +
    `👤 UPI Name: \`${s.upi_name}\`\n` +
    `🆘 Support: ${s.support_username}\n` +
    `🛠️ Maintenance: *${s.maintenance_mode?'🔴 ON':'🟢 OFF'}*\n` +
    `📝 Registration: *${s.registration_enabled?'🟢 ON':'🔴 OFF'}*`,
    { parse_mode:'Markdown', ...adminSettingsKeyboard() }
  ).catch(()=>{});
}

async function handleSetSetting(ctx, key) {
  await ctx.answerCbQuery().catch(()=>{});
  const labels = {
    coin_price:'Coin Price (₹ per coin)', min_deposit:'Min Deposit (₹)',
    max_deposit:'Max Deposit (₹)', per_refer_coins:'Per Refer Coins',
    new_user_bonus:'New User Bonus', otp_cost:'OTP Cost (coins)',
    max_otp_wait:'Max OTP Wait (seconds)', upi_id:'UPI ID',
    upi_name:'UPI Name', support_username:'Support @username',
    welcome_message:'Welcome Message', gemini_api_key:'Gemini API Key',
    sms_api_key:'SMS API Key', broadcast_delay:'Broadcast Delay (ms)',
  };
  setAdminState(ctx.from.id, { action:'set_setting', key });
  await ctx.editMessageText(
    `✏️ *Edit: ${labels[key]||key}*\n\nCurrent: \`${await getSetting(key)}\`\n\nSend new value:`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','admin:settings')]]) }
  ).catch(()=>{});
}

async function handleToggleSetting(ctx, key) {
  await ctx.answerCbQuery().catch(()=>{});
  const cur = await getSetting(key);
  await setSetting(key, !cur);
  await ctx.answerCbQuery(`✅ ${key}: ${!cur?'ON':'OFF'}`, { show_alert:true });
  await handleAdminSettings(ctx);
}

// ═══════════════════════════════════════════════════════
// MAINTENANCE MODE
// ═══════════════════════════════════════════════════════
async function handleAdminMaintenance(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const mode = await getSetting('maintenance_mode');
  await ctx.editMessageText(
    `🔧 *Maintenance Mode*\n\nCurrent Status: *${mode?'🔴 ON':'🟢 OFF'}*\n\n` +
    `When ON:\n• Regular users get maintenance message\n• Admins can still use the bot\n• No new registrations`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback(mode?'🟢 Turn OFF Maintenance':'🔴 Turn ON Maintenance', 'admin:toggle:maintenance_mode')],
      [Markup.button.callback('📝 Set Maintenance Message','admin:set:maintenance_message')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════
async function handleAdminUsers(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [total, banned, vip, verified, unverified] = await Promise.all([
    User.count(), User.count({where:{isBanned:true}}), User.count({where:{isVip:true}}),
    User.count({where:{isVerified:true}}), User.count({where:{isVerified:false}}),
  ]);
  await ctx.editMessageText(
    `👥 *User Management*\n\n` +
    `Total: *${formatCoins(total)}* | Verified: *${verified}* | Unverified: *${unverified}*\n` +
    `Banned: *${banned}* | VIP: *${vip}*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔍 Search User','admin:user:search')],
      [Markup.button.callback('📋 Recent (10)','admin:user:recent'), Markup.button.callback('🚫 Banned','admin:user:banned')],
      [Markup.button.callback('⭐ VIP Users','admin:user:vip_list'), Markup.button.callback('📊 Top Spenders','admin:user:topspend')],
      [Markup.button.callback('📅 New Today','admin:user:newtoday'), Markup.button.callback('💰 Rich Users','admin:user:richlist')],
      [Markup.button.callback('📤 Export Users','admin:user:export'), Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

async function handleAdminUserSearch(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'user_search' });
  await ctx.editMessageText(`🔍 *Search User*\n\nSend User ID or @username:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','admin:users')]]) }).catch(()=>{});
}

async function handleViewUser(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  const uid = parseInt(userId);
  const user = await User.findOne({ where: isNaN(uid) ? { username: String(userId).replace('@','') } : { telegramId: uid } });
  if (!user) return ctx.answerCbQuery('❌ User not found', { show_alert:true });
  const [orders, deps] = await Promise.all([
    OtpOrder.count({where:{userId:user.telegramId}}),
    DepositRequest.count({where:{userId:user.telegramId, status:'approved'}}),
  ]);
  await ctx.editMessageText(
    `👤 *User Profile*\n\n` +
    `🆔 ID: \`${user.telegramId}\`\n` +
    `👋 ${user.firstName||''} ${user.lastName||''}\n` +
    `📱 @${user.username||'N/A'}\n` +
    `💎 Balance: *${formatCoins(user.balance)} coins*\n` +
    `📦 Orders: *${orders}* | 💰 Deposits: *${deps}*\n` +
    `🔗 Referrals: *${user.referralCount}* | 🎁 Earned: *${user.referralEarned}*\n` +
    `⭐ VIP: ${user.isVip?'✅':'❌'} | ✅ Verified: ${user.isVerified?'Yes':'No'}\n` +
    `🚫 Banned: ${user.isBanned?`*Yes* — ${user.banReason||'No reason'}`:'No'}\n` +
    `📅 Joined: ${formatDate(user.joinedAt)}\n` +
    `🕐 Last Active: ${formatDate(user.lastActive)}`,
    { parse_mode:'Markdown', ...userManageKeyboard(user.telegramId) }
  ).catch(()=>{});
}

async function handleAddBalance(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'add_balance', userId:parseInt(userId) });
  await ctx.editMessageText(`💰 *Add Balance*\n\nUser: \`${userId}\`\n\nEnter coins to add:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel',`admin:user:view:${userId}`)]]) }).catch(()=>{});
}

async function handleDeductBalance(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'deduct_balance', userId:parseInt(userId) });
  await ctx.editMessageText(`💸 *Deduct Balance*\n\nUser: \`${userId}\`\n\nEnter coins:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel',`admin:user:view:${userId}`)]]) }).catch(()=>{});
}

async function handleBanUser(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'ban_user', userId:parseInt(userId) });
  await ctx.editMessageText(`🚫 *Ban User*\n\nUser: \`${userId}\`\n\nEnter ban reason:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel',`admin:user:view:${userId}`)]]) }).catch(()=>{});
}

async function handleUnbanUser(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  await User.update({ isBanned:false, banReason:null }, { where:{ telegramId:parseInt(userId) } });
  await ctx.telegram.sendMessage(parseInt(userId), '✅ Your account has been unbanned. Welcome back!', backToMainKeyboard()).catch(()=>{});
  await ctx.answerCbQuery('✅ Unbanned', { show_alert:true });
  await handleViewUser(ctx, userId);
}

async function handleMakeVip(ctx, userId) {
  await ctx.answerCbQuery().catch(()=>{});
  const user = await User.findOne({ where:{telegramId:parseInt(userId)} });
  if (!user) return;
  await User.update({ isVip:!user.isVip }, { where:{telegramId:parseInt(userId)} });
  await ctx.answerCbQuery(`✅ VIP ${!user.isVip?'Added':'Removed'}`, { show_alert:true });
  await handleViewUser(ctx, userId);
}

// ═══════════════════════════════════════════════════════
// DEPOSITS
// ═══════════════════════════════════════════════════════
async function handleAdminDeposits(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [p,a,r] = await Promise.all([
    DepositRequest.count({where:{status:'pending'}}),
    DepositRequest.count({where:{status:'approved'}}),
    DepositRequest.count({where:{status:'rejected'}}),
  ]);
  await ctx.editMessageText(
    `💰 *Deposit Management*\n\n⏳ Pending: *${p}*\n✅ Approved: *${a}*\n❌ Rejected: *${r}*`,
    { parse_mode:'Markdown', ...adminDepositsKeyboard() }
  ).catch(()=>{});
}

async function handleAdminDepositList(ctx, status, page=0) {
  await ctx.answerCbQuery().catch(()=>{});
  const pageSize=5, where=status==='all'?{}:{status};
  const total = await DepositRequest.count({where});
  const totalPages = Math.ceil(total/pageSize)||1;
  const pg = Math.min(parseInt(page), totalPages-1);
  const deps = await DepositRequest.findAll({ where, order:[['createdAt','DESC']], offset:pg*pageSize, limit:pageSize });
  if (!deps.length) return ctx.editMessageText(`No ${status} deposits.`, { reply_markup:{inline_keyboard:[[{text:'🔙 Back',callback_data:'admin:deposits'}]]} }).catch(()=>{});
  const em={pending:'⏳',approved:'✅',rejected:'❌'};
  let text=`💰 *Deposits (${status.toUpperCase()})* — ${pg+1}/${totalPages}\n\n`;
  for (const d of deps) text+=`${em[d.status]} *${d.coins}c* (₹${d.amountInr}) | \`${d.userId}\` | UTR: ${d.utr||'N/A'} | ${formatDate(d.createdAt)}\n\n`;
  const nav=[];
  if(pg>0) nav.push(Markup.button.callback('⬅️',`admin:deposits:${status}:${pg-1}`));
  nav.push(Markup.button.callback(`${pg+1}/${totalPages}`,'noop'));
  if(pg<totalPages-1) nav.push(Markup.button.callback('➡️',`admin:deposits:${status}:${pg+1}`));
  await ctx.editMessageText(text,{parse_mode:'Markdown',...Markup.inlineKeyboard([nav,[Markup.button.callback('🔙 Back','admin:deposits')]])}).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════
async function handleAdminOrders(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [total,recv,wait,canc,exp] = await Promise.all([
    OtpOrder.count(), OtpOrder.count({where:{status:'received'}}),
    OtpOrder.count({where:{status:'waiting'}}), OtpOrder.count({where:{status:'cancelled'}}),
    OtpOrder.count({where:{status:'expired'}}),
  ]);
  const since=new Date(); since.setHours(0,0,0,0);
  const today = await OtpOrder.count({where:{createdAt:{[Op.gte]:since}}});
  const rate = total>0?Math.round(recv/total*100):0;
  await ctx.editMessageText(
    `📦 *Orders*\n\nTotal: *${formatCoins(total)}* | Today: *${today}*\n✅ Received: *${recv}* (${rate}%)\n⏳ Active: *${wait}*\n❌ Cancelled: *${canc}* | ⏰ Expired: *${exp}*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('⏳ Active','admin:orders:waiting'), Markup.button.callback('✅ Completed','admin:orders:received')],
      [Markup.button.callback('❌ Cancelled/Expired','admin:orders:failed'), Markup.button.callback('📅 Today','admin:orders:today')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// GIFT CODES
// ═══════════════════════════════════════════════════════
async function handleAdminGiftCodes(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [total,active] = await Promise.all([GiftCode.count(), GiftCode.count({where:{isActive:true}})]);
  await ctx.editMessageText(
    `🎁 *Gift Codes*\n\nTotal: *${total}* | Active: *${active}*`,
    { parse_mode:'Markdown', ...adminGiftCodesKeyboard() }
  ).catch(()=>{});
}

async function handleCreateGiftCode(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'create_gift', step:'coins' });
  await ctx.editMessageText(`🎁 *Create Gift Code*\n\nStep 1/4: Enter coins value:`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','admin:giftcodes')]]) }).catch(()=>{});
}

async function handleListGiftCodes(ctx, page=0) {
  await ctx.answerCbQuery().catch(()=>{});
  const pageSize=8, total=await GiftCode.count();
  const totalPages=Math.ceil(total/pageSize)||1;
  const pg=Math.min(parseInt(page),totalPages-1);
  const codes=await GiftCode.findAll({ order:[['createdAt','DESC']], offset:pg*pageSize, limit:pageSize });
  let text=`🎁 *Gift Codes* — ${pg+1}/${totalPages}\n\n`;
  for (const c of codes) {
    const st=!c.isActive?'⛔':c.usedCount>=c.maxUses?'🔴':'🟢';
    text+=`${st} \`${c.code}\` — *${c.coinsValue} coins*\n   ${c.usedCount}/${c.maxUses} uses${c.expiresAt?` | ⏰ ${formatDate(c.expiresAt)}`:''}\n\n`;
  }
  const nav=[];
  if(pg>0) nav.push(Markup.button.callback('⬅️',`admin:giftcode:list:${pg-1}`));
  if(pg<totalPages-1) nav.push(Markup.button.callback('➡️',`admin:giftcode:list:${pg+1}`));
  await ctx.editMessageText(text,{parse_mode:'Markdown',...Markup.inlineKeyboard([...(nav.length?[nav]:[]),[Markup.button.callback('🔙 Back','admin:giftcodes')]])}).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// BROADCAST
// ═══════════════════════════════════════════════════════
async function handleAdminBroadcast(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const total=await User.count({where:{isBanned:false}});
  await ctx.editMessageText(
    `📢 *Broadcast*\n\nWill send to: *${total} users*\n\nChoose audience:`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('📢 All Users','admin:broadcast:all')],
      [Markup.button.callback('⭐ VIP Only','admin:broadcast:vip'), Markup.button.callback('🟢 Active 7d','admin:broadcast:active')],
      [Markup.button.callback('💎 Has Balance','admin:broadcast:hasbalance'), Markup.button.callback('🆕 New (24h)','admin:broadcast:new24h')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

async function handleBroadcastTarget(ctx, target) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'broadcast', target });
  await ctx.editMessageText(`📢 *Broadcast to ${target.toUpperCase()}*\n\nSend message (supports Markdown + photos):`, { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','admin:broadcast')]]) }).catch(()=>{});
}

async function executeBroadcast(ctx, target, message, photoFileId=null) {
  const delay=await getSetting('broadcast_delay')||50;
  const since24h=new Date(Date.now()-24*3600*1000);
  let where={isBanned:false};
  if (target==='vip') where.isVip=true;
  if (target==='active') where.lastActive={[Op.gte]:new Date(Date.now()-7*24*3600*1000)};
  if (target==='hasbalance') where.balance={[Op.gt]:0};
  if (target==='new24h') where.createdAt={[Op.gte]:since24h};
  const users=await User.findAll({where, attributes:['telegramId']});
  let sent=0, failed=0;
  const statusMsg=await ctx.reply(`📤 Sending to ${users.length} users...`);
  for (const u of users) {
    try {
      if (photoFileId) await ctx.telegram.sendPhoto(Number(u.telegramId), photoFileId, {caption:message, parse_mode:'Markdown'});
      else await ctx.telegram.sendMessage(Number(u.telegramId), message, {parse_mode:'Markdown'});
      sent++;
    } catch { failed++; }
    if(sent%20===0) await sleep(delay);
  }
  await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined,
    `✅ *Broadcast Done*\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n👥 Total: ${users.length}`,
    {parse_mode:'Markdown'}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════
async function handleAdminAnalytics(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const now=new Date();
  const tod=new Date(now); tod.setHours(0,0,0,0);
  const wk=new Date(now-7*24*3600*1000);
  const mn=new Date(now.getFullYear(),now.getMonth(),1);
  const [tu,tdu,wu,mu,to,tdo,wo,mo,recv,totalDeps] = await Promise.all([
    User.count(), User.count({where:{createdAt:{[Op.gte]:tod}}}),
    User.count({where:{createdAt:{[Op.gte]:wk}}}), User.count({where:{createdAt:{[Op.gte]:mn}}}),
    OtpOrder.count(), OtpOrder.count({where:{createdAt:{[Op.gte]:tod}}}),
    OtpOrder.count({where:{createdAt:{[Op.gte]:wk}}}), OtpOrder.count({where:{createdAt:{[Op.gte]:mn}}}),
    OtpOrder.count({where:{status:'received'}}),
    DepositRequest.count({where:{status:'approved'}}),
  ]);
  const rate=to>0?Math.round(recv/to*100):0;
  const { sequelize } = require('../database');
  const [top5] = await sequelize.query(`SELECT service, COUNT(*) as cnt FROM otp_orders GROUP BY service ORDER BY cnt DESC LIMIT 5`);
  let topTxt=''; top5.forEach((r,i)=>{ topTxt+=`${i+1}. ${r.service} — ${r.cnt}\n`; });
  await ctx.editMessageText(
    `📊 *Analytics Dashboard*\n\n` +
    `👥 *Users:*\nToday: +${tdu} | Week: +${wu} | Month: +${mu} | Total: ${formatCoins(tu)}\n\n` +
    `📦 *Orders:*\nToday: ${tdo} | Week: ${wo} | Month: ${mo} | Total: ${formatCoins(to)}\n` +
    `✅ Success Rate: *${rate}%*\n\n` +
    `💰 *Approved Deposits:* ${totalDeps}\n\n` +
    `🏆 *Top Services:*\n${topTxt||'No data'}`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','admin:main')]]) }
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// FINANCIAL
// ═══════════════════════════════════════════════════════
async function handleAdminFinancial(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const { sequelize } = require('../database');
  const [[depRow],[otpRow],[refRow]] = await Promise.all([
    sequelize.query(`SELECT COALESCE(SUM(coins),0) as tc, COALESCE(SUM("amountInr"),0) as ti FROM deposit_requests WHERE status='approved'`),
    sequelize.query(`SELECT COALESCE(SUM("coinsCharged"),0) as total FROM otp_orders`),
    sequelize.query(`SELECT COALESCE(SUM("referralEarned"),0) as total FROM users`),
  ]);
  const totalCoins=parseFloat(depRow[0]?.tc||0);
  const totalInr=parseFloat(depRow[0]?.ti||0);
  const totalOtp=parseFloat(otpRow[0]?.total||0);
  const totalRef=parseFloat(refRow[0]?.total||0);
  await ctx.editMessageText(
    `💳 *Financial Overview*\n\n` +
    `💰 Total Deposited: *₹${totalInr.toFixed(2)}*\n` +
    `💎 Coins Issued: *${formatCoins(totalCoins)}*\n` +
    `🎯 Coins Spent (OTP): *${formatCoins(totalOtp)}*\n` +
    `🔗 Coins Paid (Referral): *${formatCoins(totalRef)}*\n` +
    `📊 Profit (rough): *${formatCoins(totalCoins-totalOtp-totalRef)} coins*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('📋 All Deposits','admin:deposits:all:0')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// SECURITY
// ═══════════════════════════════════════════════════════
async function handleAdminSecurity(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [banned, multiDevice] = await Promise.all([
    User.count({where:{isBanned:true}}),
    User.count({ where: { deviceFingerprints: { [Op.ne]: [] } } }),
  ]);
  await ctx.editMessageText(
    `🔒 *Security Panel*\n\nBanned Users: *${banned}*\nDevices Tracked: *${multiDevice}*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('📋 Banned Users','admin:user:banned'), Markup.button.callback('🚫 Ban User by ID','admin:security:ban')],
      [Markup.button.callback('✅ Unban by ID','admin:security:unban')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// BOT CONFIG
// ═══════════════════════════════════════════════════════
async function handleAdminBotConfig(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [m,r,ref,gc,ar] = await Promise.all([
    getSetting('maintenance_mode'), getSetting('registration_enabled'),
    getSetting('referral_enabled'), getSetting('gift_code_enabled'), getSetting('auto_refund'),
  ]);
  await ctx.editMessageText(
    `🤖 *Bot Configuration*\n\n` +
    `🛠️ Maintenance: *${m?'🔴 ON':'🟢 OFF'}*\n` +
    `📝 Registration: *${r?'🟢 ON':'🔴 OFF'}*\n` +
    `🔗 Referral: *${ref?'🟢 ON':'🔴 OFF'}*\n` +
    `🎁 Gift Codes: *${gc?'🟢 ON':'🔴 OFF'}*\n` +
    `🔄 Auto Refund: *${ar?'🟢 ON':'🔴 OFF'}*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback(`${m?'🟢 Disable':'🔴 Enable'} Maintenance`,'admin:toggle:maintenance_mode')],
      [Markup.button.callback(`${r?'🔴 Disable':'🟢 Enable'} Registration`,'admin:toggle:registration_enabled')],
      [Markup.button.callback(`${ref?'🔴 Disable':'🟢 Enable'} Referral`,'admin:toggle:referral_enabled')],
      [Markup.button.callback(`${gc?'🔴 Disable':'🟢 Enable'} Gift Codes`,'admin:toggle:gift_code_enabled')],
      [Markup.button.callback(`${ar?'🔴 Disable':'🟢 Enable'} Auto Refund`,'admin:toggle:auto_refund')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// OTP SETTINGS
// ═══════════════════════════════════════════════════════
async function handleAdminOtpSettings(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const [cost, wait] = await Promise.all([getSetting('otp_cost'), getSetting('max_otp_wait')]);
  await ctx.editMessageText(
    `🎯 *OTP Settings*\n\n💰 OTP Cost: *${cost} coins*\n⏱️ Max Wait: *${wait}s (${Math.floor(wait/60)}m ${wait%60}s)*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('💰 Change OTP Cost','admin:set:otp_cost')],
      [Markup.button.callback('⏱️ Change Max Wait','admin:set:max_otp_wait')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// REFUNDS
// ═══════════════════════════════════════════════════════
async function handleAdminRefunds(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const expired=await OtpOrder.count({where:{status:'expired', refunded:false}});
  await ctx.editMessageText(
    `💸 *Refund Management*\n\nPending Refunds: *${expired}*`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Process All Expired Refunds','admin:refund:all')],
      [Markup.button.callback('💸 Manual Refund by Order ID','admin:refund:manual')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════
async function handleAdminChannels(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const { CHANNEL_USERNAME, GROUP_USERNAME } = require('../config');
  await ctx.editMessageText(
    `🌐 *Channel & Group Config*\n\n📢 Channel: ${CHANNEL_USERNAME}\n👥 Group: ${GROUP_USERNAME}\n\n_To change, update config.js and redeploy._`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back','admin:main')]]) }
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// ANNOUNCE
// ═══════════════════════════════════════════════════════
async function handleAdminAnnounce(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  setAdminState(ctx.from.id, { action:'broadcast', target:'all' });
  await ctx.editMessageText(
    `📣 *Send Announcement*\n\nThis will broadcast to ALL users.\nSend your message now:`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','admin:main')]]) }
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════
async function handleAdminLogs(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const since=new Date(Date.now()-60*60*1000); // last 1 hour
  const [recentOrders, recentDeps, recentUsers] = await Promise.all([
    OtpOrder.count({where:{createdAt:{[Op.gte]:since}}}),
    DepositRequest.count({where:{createdAt:{[Op.gte]:since}}}),
    User.count({where:{createdAt:{[Op.gte]:since}}}),
  ]);
  await ctx.editMessageText(
    `📋 *Live Logs (Last 1 Hour)*\n\n📦 New Orders: *${recentOrders}*\n💰 New Deposits: *${recentDeps}*\n👤 New Users: *${recentUsers}*\n\n🕐 ${new Date().toLocaleString('en-IN')}`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh','admin:logs')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// SMS API
// ═══════════════════════════════════════════════════════
async function handleAdminSmsApi(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const key=await getSetting('sms_api_key');
  const { numbersInUse } = require('../utils/firebaseSms');
  await ctx.editMessageText(
    `📱 *SMS / Firebase Config*\n\n🔑 SMS API Key: ${key?`\`${String(key).substring(0,8)}...\``:'Not set'}\n📊 Firebase DBs: *38 databases*\n🔢 Numbers In Use: *${numbersInUse.size}*\n\n_Numbers are fetched from 38 real Firebase databases with live Indian SIM cards_`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔑 Set SMS API Key','admin:set:sms_api_key')],
      [Markup.button.callback('🔄 Refresh Numbers','admin:smsapi:refresh')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// GEMINI
// ═══════════════════════════════════════════════════════
async function handleAdminGemini(ctx) {
  await ctx.answerCbQuery().catch(()=>{});
  const key=await getSetting('gemini_api_key');
  let status='❌ Not configured';
  if (key) { const t=await testGeminiKey(key); status=t.ok?'✅ Working':`❌ ${t.error}`; }
  await ctx.editMessageText(
    `🤖 *Gemini AI Settings*\n\n🔑 Key: ${key?`\`${String(key).substring(0,8)}...\``:'Not set'}\n📊 Status: ${status}\n\n_Gemini AI is used to extract OTP codes from SMS messages_`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🔑 Set Gemini Key','admin:set:gemini_api_key')],
      [Markup.button.callback('🔄 Test Key','admin:gemini')],
      [Markup.button.callback('🔙 Back','admin:main')],
    ])}
  ).catch(()=>{});
}

// ═══════════════════════════════════════════════════════
// INPUT HANDLER
// ═══════════════════════════════════════════════════════
async function handleAdminInput(ctx) {
  if (!isAdmin(ctx.from.id)) return false;
  const state=getAdminState(ctx.from.id);
  if (!state) return false;
  const text=ctx.message?.text?.trim();
  const photo=ctx.message?.photo;

  if (state.action==='set_setting') {
    clearAdminState(ctx.from.id);
    const nums=['coin_price','min_deposit','max_deposit','per_refer_coins','new_user_bonus','otp_cost','max_otp_wait','broadcast_delay'];
    const value=nums.includes(state.key)?parseFloat(text):text;
    if (nums.includes(state.key)&&isNaN(value)) { await ctx.reply('❌ Enter a valid number.'); return true; }
    await setSetting(state.key, value);
    await ctx.reply(`✅ *${state.key}* updated to \`${value}\``, {parse_mode:'Markdown'});
    await handleAdminSettings(ctx);
    return true;
  }

  if (state.action==='user_search') {
    clearAdminState(ctx.from.id);
    await handleViewUser(ctx, text);
    return true;
  }

  if (state.action==='add_balance') {
    clearAdminState(ctx.from.id);
    const coins=parseInt(text);
    if (isNaN(coins)||coins<=0) { await ctx.reply('❌ Invalid amount.'); return true; }
    const user=await User.findOne({where:{telegramId:state.userId}});
    if (!user) { await ctx.reply('❌ User not found.'); return true; }
    const balBefore=user.balance;
    await user.addBalance(coins);
    await Transaction.create({userId:state.userId,type:'admin_credit',amount:coins,description:`Admin +${coins}`,balanceBefore:balBefore,balanceAfter:user.balance});
    await ctx.telegram.sendMessage(state.userId,`💰 *+${coins} coins* added by admin!\n💎 Balance: *${user.balance} coins*`,{parse_mode:'Markdown'}).catch(()=>{});
    await ctx.reply(`✅ Added *${coins} coins* to \`${state.userId}\`\nNew balance: *${user.balance}*`,{parse_mode:'Markdown'});
    return true;
  }

  if (state.action==='deduct_balance') {
    clearAdminState(ctx.from.id);
    const coins=parseInt(text);
    if (isNaN(coins)||coins<=0) { await ctx.reply('❌ Invalid.'); return true; }
    const user=await User.findOne({where:{telegramId:state.userId}});
    if (!user) { await ctx.reply('❌ User not found.'); return true; }
    const balBefore=user.balance;
    user.balance=Math.max(0,user.balance-coins);
    await user.save();
    await Transaction.create({userId:state.userId,type:'admin_debit',amount:-coins,description:`Admin -${coins}`,balanceBefore:balBefore,balanceAfter:user.balance});
    await ctx.reply(`✅ Deducted *${coins}* from \`${state.userId}\`\nNew: *${user.balance}*`,{parse_mode:'Markdown'});
    return true;
  }

  if (state.action==='ban_user') {
    clearAdminState(ctx.from.id);
    await User.update({isBanned:true,banReason:text},{where:{telegramId:state.userId}});
    await ctx.telegram.sendMessage(state.userId,`🚫 *Banned.*\nReason: ${text}`,{parse_mode:'Markdown'}).catch(()=>{});
    await ctx.reply(`✅ User \`${state.userId}\` banned.\nReason: ${text}`,{parse_mode:'Markdown'});
    return true;
  }

  if (state.action==='create_gift') {
    if (state.step==='coins') {
      const c=parseInt(text); if(isNaN(c)||c<=0){await ctx.reply('❌ Invalid.');return true;}
      state.coins=c; state.step='max_uses'; setAdminState(ctx.from.id,state);
      await ctx.reply(`✅ Coins: *${c}*\n\nStep 2/4: Max uses:`,{parse_mode:'Markdown'}); return true;
    }
    if (state.step==='max_uses') {
      const m=parseInt(text); if(isNaN(m)||m<=0){await ctx.reply('❌ Invalid.');return true;}
      state.maxUses=m; state.step='min_deposit'; setAdminState(ctx.from.id,state);
      await ctx.reply(`✅ Max Uses: *${m}*\n\nStep 3/4: Min deposit required (0 = none):`,{parse_mode:'Markdown'}); return true;
    }
    if (state.step==='min_deposit') {
      const d=parseInt(text); if(isNaN(d)){await ctx.reply('❌ Invalid.');return true;}
      state.minDeposit=d; state.step='expiry'; setAdminState(ctx.from.id,state);
      await ctx.reply(`✅ Min Deposit: *${d}*\n\nStep 4/4: Expiry days (0 = never):`,{parse_mode:'Markdown'}); return true;
    }
    if (state.step==='expiry') {
      clearAdminState(ctx.from.id);
      const expDays=parseInt(text);
      const code=generateGiftCode();
      const expiresAt=expDays>0?new Date(Date.now()+expDays*86400000):null;
      await GiftCode.create({code,coinsValue:state.coins,maxUses:state.maxUses,minDepositRequired:state.minDeposit,expiresAt,createdBy:ctx.from.id,isActive:true});
      await ctx.reply(`✅ *Gift Code Created!*\n\n🎁 Code: \`${code}\`\n💎 Value: *${state.coins} coins*\n🔢 Max Uses: *${state.maxUses}*\n💰 Min Deposit: *${state.minDeposit}*\n⏰ ${expiresAt?formatDate(expiresAt):'Never'}`,{parse_mode:'Markdown',...Markup.inlineKeyboard([[Markup.button.callback('🔙 Gift Codes','admin:giftcodes')]])});
      return true;
    }
  }

  if (state.action==='broadcast') {
    clearAdminState(ctx.from.id);
    const photoFileId=photo?photo[photo.length-1].file_id:null;
    const msgText=ctx.message.caption||text||'';
    await executeBroadcast(ctx,state.target,msgText,photoFileId);
    return true;
  }

  return false;
}

module.exports = {
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
};
