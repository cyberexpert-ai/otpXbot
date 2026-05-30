# 🤖 OtpX Bot

Advanced OTP Service Telegram Bot with Firebase SMS integration.

## 🚀 Quick Setup

### 1. Clone & Install
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Your bot token from @BotFather |
| `MONGO_URI` | MongoDB connection string |
| `WEBHOOK_URL` | Your Render app URL (e.g. https://otpx.onrender.com) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `UPI_ID` | Your UPI ID for payments |
| `SUPPORT_USERNAME` | Your support Telegram username |

### 3. Render Deployment

| Setting | Value |
|---|---|
| **Build Command** | `npm install` |
| **Start Command** | `node src/index.js` |
| **Environment** | Node |

### Render Environment Variables to set:
```
BOT_TOKEN=8713852719:YOUR_TOKEN
MONGO_URI=mongodb+srv://...
WEBHOOK_URL=https://YOUR-APP.onrender.com
GEMINI_API_KEY=AIza...
UPI_ID=yourname@upi
UPI_NAME=OtpX Service
SUPPORT_USERNAME=@your_support
PORT=3000
```

### 4. Admin Setup
Admin IDs are set in `src/config.js`:
- `8004114088`
- `7291283007`

Send `/admin` to access the admin panel.

## 📁 Project Structure
```
src/
├── index.js          # Main entry
├── config.js         # Config & constants
├── database.js       # MongoDB connection
├── server.js         # Express server + webhook
├── handlers/
│   ├── start.js      # Start, join check, device verify
│   ├── getOtp.js     # OTP flow
│   ├── deposit.js    # Deposit flow
│   ├── profile.js    # Profile, balance, refer, history, gift code
│   ├── support.js    # Support & status
│   └── admin.js      # Full admin panel
├── models/
│   ├── User.js
│   ├── OtpOrder.js
│   ├── Transaction.js
│   ├── DepositRequest.js
│   ├── GiftCode.js
│   └── Settings.js
├── utils/
│   ├── firebaseSms.js  # 38 Firebase DBs integration
│   ├── gemini.js       # AI OTP extraction
│   ├── helpers.js
│   ├── keyboards.js
│   └── services.js     # 4000+ services
└── miniapp/
    └── index.html      # Device verification mini app
```

## 🔑 Key Features
- ✅ Channel + Group join verification
- ✅ Device fingerprint anti-fraud
- ✅ 38 Firebase databases for real Indian numbers
- ✅ Gemini AI OTP extraction
- ✅ UPI deposit with screenshot verification
- ✅ Referral system with fraud detection
- ✅ Gift codes with conditions
- ✅ Full admin panel (200+ features)
- ✅ Auto-refund on OTP timeout
- ✅ Broadcast to all/VIP/active users
- ✅ Analytics dashboard
