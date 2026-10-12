/**
 * Vercel Serverless Function: GAS Reverse Proxy & API Gateway
 * Menjembatani request dari client Vercel ke Google Apps Script Web App.
 * Menangani HTTP 302 Redirect dari Google secara otomatis tanpa kendala CORS di browser.
 */

module.exports = async function handler(req, res) {
  // Atur header CORS agar request lokal maupun staging bekerja lancar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const gasUrl = process.env.GAS_DEPLOYMENT_URL;
  if (!gasUrl) {
    return res.status(500).json({
      success: false,
      message: 'Server Configuration Error: GAS_DEPLOYMENT_URL belum diatur di Environment Variables Vercel.'
    });
  }

  // Support health-check / ping lewat GET
  if (req.method === 'GET') {
    try {
      const pingUrl = gasUrl.includes('?') ? `${gasUrl}&ping=1` : `${gasUrl}?ping=1`;
      const pingRes = await fetch(pingUrl, { redirect: 'follow' });
      const pingText = await pingRes.text();
      let pingJson;
      try { pingJson = JSON.parse(pingText); } catch (e) { pingJson = { message: pingText }; }
      return res.status(pingRes.status).json(pingJson);
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Ping ke GAS gagal: ' + err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    let payload = req.body;
    if (!payload && req.readable) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      try { payload = JSON.parse(raw); } catch (e) { payload = raw; }
    } else if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }

    // Teruskan payload ke Google Apps Script Web App dengan follow redirect otomatis
    const response = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow', // Mengikuti HTTP 302 redirect dari GAS ke googleusercontent.com
      headers: {
        'Content-Type': 'application/json'
      },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload || {})
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { success: false, message: responseText };
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[GAS Proxy Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Proxy Error saat menghubungi Google Apps Script: ' + error.message
    });
  }
};
