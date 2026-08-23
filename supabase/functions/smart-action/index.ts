/**
 * smart-action — CardCom Success/Failed redirect landing page (public).
 *
 * CardCom opens this URL in the buyer WebView without Authorization headers.
 * Must be deployed with verify_jwt=false.
 *
 * UX only: show Hebrew success/failure HTML + postMessage to RN WebView.
 * Do NOT treat this page as payment proof — activation is rapid-responder + GetLpResult.
 *
 * IMPORTANT — Supabase Edge Functions rewrite GET responses with Content-Type
 * text/html → text/plain (+ CSP sandbox). That makes WebViews show raw source
 * and mojibake Hebrew. Workarounds used here:
 * - GET: 302 redirect to a data:text/html;charset=utf-8;base64,... URL
 * - POST: return text/html; charset=utf-8 directly (not rewritten)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** UTF-8 Hebrew via unicode escapes — safe across deploy/encoding paths */
const HE = {
  titleOk: '\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05D5\u05E9\u05DC\u05DD \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4',
  titleFail: '\u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05DC\u05D0 \u05D4\u05D5\u05E9\u05DC\u05DD',
  bodyOk:
    '\u05DE\u05D7\u05D6\u05D9\u05E8\u05D9\u05DD \u05D0\u05D5\u05EA\u05DA \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4...',
  bodyFail:
    '\u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05E0\u05DB\u05E9\u05DC \u05D0\u05D5 \u05D1\u05D5\u05D8\u05DC. \u05DE\u05D7\u05D6\u05D9\u05E8\u05D9\u05DD \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4...',
  back: '\u05D4\u05DE\u05E9\u05DA \u05DC\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4',
  txLabel: '\u05DE\u05E1\u05E4\u05E8 \u05E2\u05E1\u05E7\u05D4: ',
} as const;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function landingHtml(isSuccess: boolean, transactionId: string): string {
  const title = isSuccess ? HE.titleOk : HE.titleFail;
  const body = isSuccess ? HE.bodyOk : HE.bodyFail;
  const accent = isSuccess ? '#05d157' : '#DC2626';
  const icon = isSuccess ? '\u2713' : '\u2715';
  const deepLink = isSuccess ? 'darkpoolapp://payment/success' : 'darkpoolapp://payment/error';
  const messageType = isSuccess ? 'payment_success' : 'payment_failed';
  const safeTx = esc(transactionId);
  const safeMsg = esc(body);

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #121212;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
    }
    .container {
      background: #1A1A1A;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      border: 1px solid #2a2a2a;
      max-width: 400px;
      width: 100%;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: ${accent};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
      color: #FFFFFF;
    }
    h1 { font-size: 24px; margin: 0 0 12px; font-weight: 700; }
    p { color: rgba(255,255,255,0.65); font-size: 16px; line-height: 1.6; margin: 0 0 28px; }
    .button {
      background: ${accent};
      color: #FFFFFF;
      padding: 16px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      display: inline-block;
    }
    .tx {
      margin-top: 20px;
      padding: 12px;
      border-radius: 8px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: ${accent};
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      word-break: break-all;
    }
    .logo { margin-top: 24px; font-size: 14px; color: rgba(255,255,255,0.4); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${esc(title)}</h1>
    <p>${safeMsg}</p>
    <a class="button" href="${deepLink}">${esc(HE.back)}</a>
    ${safeTx ? `<div class="tx">${esc(HE.txLabel)}${safeTx}</div>` : ''}
    <div class="logo">DarkPool</div>
  </div>
  <script>
    (function () {
      var payload = JSON.stringify({
        type: '${messageType}',
        transactionId: ${JSON.stringify(transactionId)},
        status: '${isSuccess ? 'success' : 'failed'}',
        message: ${JSON.stringify(body)}
      });
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(payload);
        }
      } catch (e) {}
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      } catch (e) {}
      // Deep-link ASAP so the app can leave this fallback page immediately.
      setTimeout(function () {
        window.location.href = '${deepLink}';
      }, 80);
    })();
  </script>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  const body = new TextEncoder().encode(html);
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** Bypass Supabase GET text/html → text/plain rewrite */
function dataUrlRedirect(html: string): Response {
  const location = `data:text/html;charset=utf-8;base64,${utf8ToBase64(html)}`;
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: location,
      'Cache-Control': 'no-store',
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // CardCom may append params on GET redirect, or POST form fields
    let responseCode = url.searchParams.get('ResponseCode')
      ?? url.searchParams.get('responsecode')
      ?? '';
    let transactionId = url.searchParams.get('TranzactionId')
      ?? url.searchParams.get('TransactionId')
      ?? url.searchParams.get('ReturnValue')
      ?? '';

    if (req.method === 'POST') {
      try {
        const contentType = (req.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          const body = await req.json().catch(() => ({})) as Record<string, unknown>;
          if (!responseCode && body.ResponseCode != null) responseCode = String(body.ResponseCode);
          if (!transactionId) {
            transactionId = String(
              body.TranzactionId ?? body.TransactionId ?? body.ReturnValue ?? '',
            );
          }
        } else {
          const form = await req.formData();
          if (!responseCode) responseCode = String(form.get('ResponseCode') ?? '');
          if (!transactionId) {
            transactionId = String(
              form.get('TranzactionId') ?? form.get('TransactionId') ?? form.get('ReturnValue') ?? '',
            );
          }
        }
      } catch {
        // ignore body parse errors — still show a page
      }
    }

    // UX hint only — never payment proof. Prefer ?dp= from create-payment redirect URLs.
    const dp = url.searchParams.get('dp');
    const isSuccess =
      dp === 'ok' || (dp !== 'fail' && (responseCode === '0' || responseCode === ''));

    console.log('[smart-action] redirect landing', {
      method: req.method,
      responseCode: responseCode || '(empty)',
      hasTransactionId: Boolean(transactionId),
      isSuccessHint: isSuccess,
    });

    const html = landingHtml(isSuccess, transactionId);

    // GET is rewritten by Supabase to text/plain — use data: redirect instead.
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (req.method === 'HEAD') {
        // Keep HEAD cheap; Content-Type may still report html for HEAD.
        return new Response(null, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
      return dataUrlRedirect(html);
    }

    return htmlResponse(html);
  } catch (error) {
    console.error('[smart-action] unexpected', error);
    const html = landingHtml(false, '');
    if (req.method === 'GET') return dataUrlRedirect(html);
    return htmlResponse(html);
  }
});
