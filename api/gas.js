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

  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxo0zETjEVccRTmBB9x6TXAQm4MthVDItWKNYQtJVQFUTJfjLBQCg_74y_jfKE0IAVF/exec';
  const gasUrl = process.env.GAS_DEPLOYMENT_URL || DEFAULT_GAS_URL;

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
    let response = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow', // Mengikuti HTTP 302 redirect dari GAS ke googleusercontent.com
      headers: {
        'Content-Type': 'application/json'
      },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload || {})
    });

    let responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // Jika doPost belum aktif di versi deployment GAS lama, fallback otomatis via GET
      if (responseText.includes('doPost') || responseText.includes('tidak ditemukan')) {
        try {
          const action = (payload && (payload.action || payload.functionName)) || '';
          const argsStr = JSON.stringify((payload && payload.args) || []);
          const fallbackUrl = gasUrl + (gasUrl.includes('?') ? '&' : '?') + 'action=' + encodeURIComponent(action) + '&args=' + encodeURIComponent(argsStr);
          const getRes = await fetch(fallbackUrl, { redirect: 'follow' });
          const getText = await getRes.text();
          try {
            data = JSON.parse(getText);
          } catch (ex) {
            data = {
              success: false,
              message: 'Endpoint Google Apps Script belum diperbarui ke versi dengan doPost/doGet API. Silakan buka editor Apps Script, simpan Code.gs terbaru, lalu klik Terapkan > Kelola Penerapan > Edit (ikon pensil) > pilih Versi Baru > Terapkan.'
            };
          }
        } catch (fbErr) {
          data = {
            success: false,
            message: 'Endpoint Google Apps Script belum siap menerima API request. Silakan perbarui versi deployment di Apps Script.'
          };
        }
      } else {
        const cleanMsg = responseText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        data = { success: false, message: cleanMsg.substring(0, 300) || 'Respon dari Google Apps Script tidak valid' };
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[GAS Proxy Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Proxy Error saat menghubungi Google Apps Script: ' + error.message
    });
  }
};
