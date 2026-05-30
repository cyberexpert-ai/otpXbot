const User = require('../models/User');
const { getSetting } = require('../models/Settings');
const Transaction = require('../models/Transaction');
const { generateReferralCode, hashFingerprint } = require('../utils/helpers');
const { mainMenuKeyboard } = require('../utils/keyboards');
const { Markup } = require('telegraf');
const { CHANNEL_ID, CHANNEL_USERNAME, GROUP_ID, GROUP_USERNAME, ADMIN_IDS, MINI_APP_URL } = require('../config');

async function checkMembership(ctx, userId) {
  try {
    const [c, g] = await Promise.all([
      ctx.telegram.getChatMember(CHANNEL_ID, userId),
      ctx.telegram.getChatMember(GROUP_ID, userId),
    ]);
    const v = ['member','administrator','creator'];
    return { channel: v.includes(c.status), group: v.includes(g.status) };
  } catch { return { channel: false, group: false }; }
}

async function sendJoinPrompt(ctx) {
  await ctx.reply(
    `🚀 *Welcome to OtpX Bot!*\n\nJoin our channel and group first, then click ✅ Joined.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Join Channel', `https://t.me/${CHANNEL_USERNAME.replace('@','')}`)],
        [Markup.button.url('👥 Join Group', `https://t.me/${GROUP_USERNAME.replace('@','')}`)],
        [Markup.button.callback('✅ Joined', 'check:joined')],
      ]),
    }
  );
}

async function sendDeviceVerification(ctx) {
  const url = (MINI_APP_URL || `https://t.me/${ctx.botInfo?.username}`) + '/verify';
  await ctx.reply(
    `🔐 *Device Verification Required*\n\nTap below to verify your device (anti-fraud check):`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.webApp('🔐 Verify My Device', url)]]),
    }
  );
}

async function sendMainMenu(ctx, user) {
  const welcome = await getSetting('welcome_message');
  await ctx.reply(
    `${welcome}\n\n👋 Hello *${user.firstName || 'User'}*!\n💎 Balance: *${user.balance} coins*\n\nChoose an option:`,
    { parse_mode: 'Markdown', ...mainMenuKeyboard() }
  );
}

async function handleStart(ctx) {
  const userId = ctx.from.id;
  const args = ctx.message?.text?.split(' ')[1] || '';

  if (await getSetting('maintenance_mode') && !ADMIN_IDS.includes(userId))
    return ctx.reply('🛠️ Bot is under maintenance. Try again later.');

  const membership = await checkMembership(ctx, userId);
  if (!membership.channel || !membership.group) return sendJoinPrompt(ctx);

  let user = await User.findOne({ where: { telegramId: userId } });

  if (!user) {
    if (!await getSetting('registration_enabled'))
      return ctx.reply('❌ Registration is currently disabled.');

    user = await User.create({
      telegramId: userId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      referralCode: generateReferralCode(userId),
      balance: 0,
    });

    if (args.startsWith('ref_')) {
      const referrer = await User.findOne({ where: { referralCode: args.replace('ref_','') } });
      if (referrer && Number(referrer.telegramId) !== userId) {
        user.referredBy = referrer.telegramId;
        await user.save();
      }
    }
    await sendDeviceVerification(ctx);
    return;
  }

  if (user.isBanned) return ctx.reply(`🚫 Banned.\nReason: ${user.banReason || 'Violation of terms'}`);

  user.username = ctx.from.username;
  user.firstName = ctx.from.first_name;
  user.lastActive = new Date();
  await user.save();

  if (!user.isVerified) return sendDeviceVerification(ctx);
  await sendMainMenu(ctx, user);
}

async function handleJoinedCheck(ctx) {
  await ctx.answerCbQuery('Checking...').catch(() => {});
  const userId = ctx.from.id;
  const membership = await checkMembership(ctx, userId);
  if (!membership.channel || !membership.group)
    return ctx.answerCbQuery('❌ Please join both channel and group first!', { show_alert: true });

  let user = await User.findOne({ where: { telegramId: userId } });
  if (!user || !user.isVerified) {
    const url = (MINI_APP_URL || `https://t.me/${ctx.botInfo?.username}`) + '/verify';
    await ctx.editMessageText(
      `✅ *Membership Verified!*\n\nNow complete device verification:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.webApp('🔐 Verify Device', url)]]) }
    ).catch(() => {});
    return;
  }
  await ctx.deleteMessage().catch(() => {});
  await sendMainMenu(ctx, user);
}

async function handleWebAppData(ctx) {
  const userId = ctx.from.id;
  const raw = ctx.webAppData?.data?.data;
  try {
    const deviceData = JSON.parse(raw);
    const fingerprint = hashFingerprint({
      userAgent: deviceData.userAgent, screenRes: deviceData.screenRes,
      timezone: deviceData.timezone, language: deviceData.language, platform: deviceData.platform,
    });
    const ip = deviceData.ip || 'unknown';
    let user = await User.findOne({ where: { telegramId: userId } });
    if (!user) return;

    const existing = await User.findOne({
      where: { isVerified: true },
      // check fingerprint in array
    });

    // Check fingerprint clash across all users
    const allUsers = await User.findAll({ where: { isVerified: true } });
    const isSameDevice = allUsers.some(u =>
      Number(u.telegramId) !== userId && (u.deviceFingerprints || []).includes(fingerprint)
    );

    const fp = user.deviceFingerprints || [];
    const ips = user.ipAddresses || [];
    if (!fp.includes(fingerprint)) fp.push(fingerprint);
    if (!ips.includes(ip)) ips.push(ip);
    user.deviceFingerprints = fp;
    user.ipAddresses = ips;
    user.isVerified = true;
    await user.save();

    if (!isSameDevice && !user.bonusReceived) {
      const bonus = await getSetting('new_user_bonus');
      if (bonus > 0) {
        user.balance += bonus;
        user.bonusReceived = true;
        await user.save();
        await Transaction.create({ userId, type:'new_user_bonus', amount:bonus, description:'Welcome bonus', balanceAfter:user.balance });
      }
      if (user.referredBy) {
        const refEnabled = await getSetting('referral_enabled');
        if (refEnabled) {
          const perRefer = await getSetting('per_refer_coins');
          const referrer = await User.findOne({ where: { telegramId: user.referredBy } });
          if (referrer && !referrer.isBanned) {
            referrer.balance += perRefer;
            referrer.referralCount += 1;
            referrer.referralEarned += perRefer;
            await referrer.save();
            await Transaction.create({ userId: Number(referrer.telegramId), type:'referral_bonus', amount:perRefer, description:`Referral bonus for ${userId}`, balanceAfter:referrer.balance });
            await ctx.telegram.sendMessage(Number(referrer.telegramId), `🎉 *Referral Bonus!*\n\n+${perRefer} coins earned!\n💎 Balance: *${referrer.balance} coins*`, { parse_mode:'Markdown' }).catch(()=>{});
          }
        }
      }
    }

    const welcome = await getSetting('welcome_message');
    const bonusText = !isSameDevice && user.bonusReceived ? `\n🎁 Welcome bonus credited!` : '';
    if (isSameDevice) {
      await ctx.reply(`⚠️ *Same Device Detected*\n\nYou can use the bot but referral bonus won't be counted.\n\n💎 Balance: *${user.balance} coins*`, { parse_mode:'Markdown', ...mainMenuKeyboard() });
    } else {
      await ctx.reply(`✅ *Verified!*\n\n${welcome}${bonusText}\n\n👋 *${ctx.from.first_name}*\n💎 Balance: *${user.balance} coins*`, { parse_mode:'Markdown', ...mainMenuKeyboard() });
    }
  } catch (err) {
    console.error('WebApp error:', err);
    await ctx.reply('❌ Verification failed. Try again.', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Retry', 'start:retry')]]),
    });
  }
}

module.exports = { handleStart, handleJoinedCheck, handleWebAppData, sendMainMenu, checkMembership };
