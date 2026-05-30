const axios = require('axios');
const { getSetting } = require('../models/Settings');

async function getApiKey() {
  return await getSetting('sms_api_key');
}

const API_BASE = 'https://api.sms-activate.org/stubs/handler_api.php';

async function getBalance() {
  const apiKey = await getApiKey();
  const { data } = await axios.get(API_BASE, {
    params: { api_key: apiKey, action: 'getBalance' }
  });
  if (data.startsWith('ACCESS_BALANCE:')) {
    return parseFloat(data.split(':')[1]);
  }
  throw new Error('Failed to get balance: ' + data);
}

async function getNumber(service, country = '0') {
  const apiKey = await getApiKey();
  const { data } = await axios.get(API_BASE, {
    params: {
      api_key: apiKey,
      action: 'getNumber',
      service,
      country,
    },
  });

  if (data === 'NO_NUMBERS') throw new Error('No numbers available for this service');
  if (data === 'NO_BALANCE') throw new Error('Insufficient SMS API balance');
  if (data.startsWith('ACCESS_NUMBER:')) {
    const parts = data.split(':');
    return { activationId: parts[1], phoneNumber: parts[2] };
  }
  throw new Error('Failed to get number: ' + data);
}

async function setStatus(activationId, status) {
  const apiKey = await getApiKey();
  const { data } = await axios.get(API_BASE, {
    params: {
      api_key: apiKey,
      action: 'setStatus',
      id: activationId,
      status,
    },
  });
  return data;
}

async function getStatus(activationId) {
  const apiKey = await getApiKey();
  const { data } = await axios.get(API_BASE, {
    params: {
      api_key: apiKey,
      action: 'getStatus',
      id: activationId,
    },
  });

  if (data === 'STATUS_WAIT_CODE') return { status: 'waiting', sms: null };
  if (data === 'STATUS_CANCEL') return { status: 'cancelled', sms: null };
  if (data.startsWith('STATUS_OK:')) {
    return { status: 'received', sms: data.split(':')[1] };
  }
  if (data === 'STATUS_WAIT_RETRY') return { status: 'waiting_retry', sms: null };
  return { status: 'unknown', sms: null };
}

async function cancelActivation(activationId) {
  return await setStatus(activationId, 8);
}

async function getNumbersAvailability(service, country = '0') {
  const apiKey = await getApiKey();
  const { data } = await axios.get(API_BASE, {
    params: {
      api_key: apiKey,
      action: 'getNumbersStatus',
      country,
      operator: 'any',
    },
  });
  try {
    const parsed = JSON.parse(data);
    const key = `${service}_0`;
    return parsed[key] || 0;
  } catch {
    return 0;
  }
}

module.exports = {
  getBalance,
  getNumber,
  getStatus,
  setStatus,
  cancelActivation,
  getNumbersAvailability,
};
