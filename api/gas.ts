import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  method?: string;
  url?: string;
}

interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (data: any) => void;
  send: (body: any) => void;
  end: (cb?: () => void) => any;
}

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbxo0zETjEVccRTmBB9x6TXAQm4MthVDItWKNYQtJVQFUTJfjLBQCg_74y_jfKE0IAVF/exec';

const getGasUrl = (): string => {
  return (
    process.env.GAS_URL ||
    process.env.GAS_DEPLOYMENT_URL ||
    process.env.VITE_GAS_URL ||
    DEFAULT_GAS_URL
  ).trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS Headers untuk keamanan dan fleksibilitas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const gasUrl = getGasUrl();
  const gasUrlSource = process.env.GAS_URL
    ? 'GAS_URL (Vercel Secret)'
    : process.env.GAS_DEPLOYMENT_URL
    ? 'GAS_DEPLOYMENT_URL'
    : 'DEFAULT_FALLBACK';

  // 1. HANDLER GET: Health Check & Status Koneksi ke Google Apps Script
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const startTime = Date.now();
    const maskedUrl =
      gasUrl.length > 35
        ? `${gasUrl.substring(0, 38)}...${gasUrl.substring(gasUrl.length - 8)}`
        : gasUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 24000);

    try {
      const pingUrl = gasUrl.includes('?') ? `${gasUrl}&action=ping` : `${gasUrl}?action=ping`;
      const pingRes = await fetch(pingUrl, {
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isOk = pingRes.status >= 200 && pingRes.status < 400;

      return res.status(isOk ? 200 : 502).json({
        success: isOk,
        connected: isOk,
        source: gasUrlSource,
        maskedUrl,
        latencyMs,
        statusCode: pingRes.status,
        message: isOk
          ? 'Sistem berhasil terhubung ke Google Apps Script (Vercel Serverless Ready)'
          : `Respon GAS kode status: ${pingRes.status}`,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      return res.status(503).json({
        success: false,
        connected: false,
        source: gasUrlSource,
        maskedUrl,
        latencyMs: Date.now() - startTime,
        message: isTimeout
          ? 'Waktu tunggu koneksi ke GAS habis saat cold-start (24s)'
          : 'Gagal terhubung ke GAS: ' + (err?.message || 'Network error'),
      });
    }
  }

  // 2. HANDLER POST: Proxy Pemanggilan API ke Google Apps Script
  if (req.method === 'POST') {
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }

    const action = (payload.action || payload.functionName || '').trim();
    const args = payload.args || [];

    const tryGetFallback = async (): Promise<any> => {
      try {
        const fallbackUrl =
          gasUrl +
          (gasUrl.includes('?') ? '&' : '?') +
          'action=' +
          encodeURIComponent(action) +
          '&args=' +
          encodeURIComponent(JSON.stringify(args));
        const getRes = await fetch(fallbackUrl, {
          method: 'GET',
          redirect: 'follow',
        });
        const getText = await getRes.text();
        return JSON.parse(getText);
      } catch {
        return null;
      }
    };

    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        const getData = await tryGetFallback();
        if (getData) {
          data = getData;
        } else {
          const cleanMsg = responseText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          data = {
            success: false,
            message: cleanMsg.substring(0, 300) || 'Respon dari Google Apps Script tidak valid',
          };
        }
      }

      return res.status(200).json(data);
    } catch (error: any) {
      const getData = await tryGetFallback();
      if (getData) {
        return res.status(200).json(getData);
      }
      return res.status(500).json({
        success: false,
        message: 'Vercel Proxy Error saat menghubungi Google Apps Script: ' + error.message,
      });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
