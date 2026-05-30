const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSetting } = require('../models/Settings');

async function extractOtpFromSms(smsText, serviceName) {
  try {
    const apiKey = await getSetting('gemini_api_key');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Extract the OTP/verification code from this SMS message for the service "${serviceName}".
SMS: "${smsText}"

Rules:
- Return ONLY the numeric OTP code, nothing else
- If multiple numbers found, return the most likely OTP (usually 4-8 digits)
- If no OTP found, return "NOT_FOUND"
- Do not include any explanation

OTP:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    if (response === 'NOT_FOUND' || !response.match(/^\d{4,8}$/)) {
      return null;
    }

    return response;
  } catch (err) {
    console.error('Gemini error:', err.message);
    return null;
  }
}

async function testGeminiKey(apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say OK');
    return { ok: true, response: result.response.text() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { extractOtpFromSms, testGeminiKey };
