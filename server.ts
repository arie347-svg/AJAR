import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxo0zETjEVccRTmBB9x6TXAQm4MthVDItWKNYQtJVQFUTJfjLBQCg_74y_jfKE0IAVF/exec';
const gasUrl = (
  process.env.GAS_URL ||
  process.env.GAS_DEPLOYMENT_URL ||
  process.env.VITE_GAS_URL ||
  DEFAULT_GAS_URL
).trim();

const gasUrlSource = process.env.GAS_URL
  ? 'GAS_URL (Secret)'
  : process.env.GAS_DEPLOYMENT_URL
  ? 'GAS_DEPLOYMENT_URL'
  : 'DEFAULT_FALLBACK';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health-check & status koneksi sistem Google Apps Script
const handleGasStatus = async (req: Request, res: Response) => {
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

    res.status(isOk ? 200 : 502).json({
      success: isOk,
      connected: isOk,
      source: gasUrlSource,
      maskedUrl,
      latencyMs,
      statusCode: pingRes.status,
      message: isOk
        ? 'Sistem berhasil terhubung ke Google Apps Script (Spreadsheet Aktif)'
        : `Respon GAS kode status: ${pingRes.status}`,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    res.status(503).json({
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
};

app.get('/api/gas', handleGasStatus);
app.get('/api/gas/status', handleGasStatus);

// Proxy to Google Apps Script Web App
app.post('/api/gas', async (req: Request, res: Response) => {
  const payload = req.body || {};
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
    } catch (e: any) {
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
      // POST tidak mengembalikan JSON valid (mungkin HTML 302/redirect/error) -> coba GET fallback
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

    res.status(200).json(data);
  } catch (error: any) {
    // Jika fetch POST gagal koneksi/timeout, coba fallback GET
    const getData = await tryGetFallback();
    if (getData) {
      return res.status(200).json(getData);
    }
    console.error('[GAS Proxy Error]', error);
    res.status(500).json({
      success: false,
      message: 'Proxy Error saat menghubungi Google Apps Script: ' + error.message,
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`AJAR applet listening on http://${HOST}:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Server Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server Unhandled Rejection]', reason);
});

startServer();

