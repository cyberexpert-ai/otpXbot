const express = require('express');
const path = require('path');
const { PORT, WEBHOOK_URL, BOT_TOKEN } = require('./config');
const User = require('./models/User');
const { hashFingerprint } = require('./utils/helpers');
const Transaction = require('./models/Transaction');
const { getSetting } = require('./models/Settings');

function createServer(bot) {
  const app = express();
  app.use(express.json({ limit:'5mb' }));
  app.use(express.urlencoded({ extended:true }));

  app.use('/miniapp', express.static(path.join(__dirname, 'miniapp')));
  app.get('/verify', (req, res) => res.sendFile(path.join(__dirname, 'miniapp', 'index.html')));

  app.post('/verify', async (req, res) => {
    try {
      const { userId, deviceData } = req.body;
      if (!userId || !deviceData) return res.json({ ok:false });
      const uid = parseInt(userId);
      const fingerprint = hashFingerprint({ userAgent:deviceData.userAgent, screenRes:deviceData.screenRes, timezone:deviceData.timezone, language:deviceData.language, platform:deviceData.platform });
      const ip = deviceData.ip || req.ip || 'unknown';
      const user = await User.findOne({ where:{ telegramId:uid } });
      if (!user) return res.json({ ok:false });

      const allVerified = await User.findAll({ where:{ isVerified:true } });
      const isSameDevice = allVerified.some(u => Number(u.telegramId)!==uid && (u.deviceFingerprints||[]).includes(fingerprint));

      const fp = user.deviceFingerprints||[];
      const ips = user.ipAddresses||[];
      if(!fp.includes(fingerprint)) fp.push(fingerprint);
      if(!ips.includes(ip)) ips.push(ip);
      user.deviceFingerprints = fp;
      user.ipAddresses = ips;
      user.isVerified = true;
      await user.save();

      const { Markup } = require('telegraf');
      const { mainMenuKeyboard } = require('./utils/keyboards');

      if (!isSameDevice && !user.bonusReceived) {
        const bonus = await getSetting('new_user_bonus');
        if (bonus>0) { user.balance+=bonus; user.bonusReceived=true; await user.save(); await Transaction.create({ userId:uid, type:'new_user_bonus', amount:bonus, description:'Welcome bonus', balanceAfter:user.balance }); }
        if (user.referredBy) {
          const perRefer = await getSetting('per_refer_coins');
          const referrer = await User.findOne({ where:{ telegramId:user.referredBy } });
          if (referrer&&!referrer.isBanned) {
            referrer.balance+=perRefer; referrer.referralCount+=1; referrer.referralEarned+=perRefer;
            await referrer.save();
            await Transaction.create({ userId:Number(referrer.telegramId), type:'referral_bonus', amount:perRefer, description:`Referral for ${uid}`, balanceAfter:referrer.balance });
            await bot.telegram.sendMessage(Number(referrer.telegramId),`🎉 *Referral Bonus!*\n\n+${perRefer} coins!\n💎 Balance: *${referrer.balance} coins*`,{parse_mode:'Markdown'}).catch(()=>{});
          }
        }
      }
      const welcome = await getSetting('welcome_message');
      await bot.telegram.sendMessage(uid,
        isSameDevice?`⚠️ *Same Device Detected*\n\nBot is usable but referral not counted.\n💎 Balance: *${user.balance} coins*`:`✅ *Verified!*\n\n${welcome}\n\n👋 Welcome!\n💎 Balance: *${user.balance} coins*`,
        { parse_mode:'Markdown', ...mainMenuKeyboard() }
      ).catch(()=>{});
      res.json({ ok:true });
    } catch(err) { res.json({ ok:false, error:err.message }); }
  });

  app.get('/', (req, res) => res.json({ status:'OtpX Bot Running', uptime:Math.floor(process.uptime())+'s' }));
  app.get('/health', (req, res) => res.json({ status:'ok' }));

  if (WEBHOOK_URL) {
    const wp = `/webhook/${BOT_TOKEN}`;
    app.use(wp, bot.webhookCallback(wp));
  }
  return app;
}

module.exports = { createServer };
