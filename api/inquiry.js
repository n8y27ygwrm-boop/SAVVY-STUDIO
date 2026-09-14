const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// --- 1. Origin & Referer Policy ---
const PRODUCTION_ALLOWED_ORIGINS = new Set([
  'https://savvystudio.cc',
  'https://www.savvystudio.cc'
]);

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function getAllowedOrigins() {
  const allowed = new Set(PRODUCTION_ALLOWED_ORIGINS);

  // Optional exact Vercel deployment origin configured explicitly
  const envAllowedOrigin = process.env.INQUIRY_ALLOWED_ORIGIN;
  if (envAllowedOrigin && typeof envAllowedOrigin === 'string') {
    try {
      const parsed = new URL(envAllowedOrigin.trim());
      if (parsed.protocol === 'https:' && parsed.hostname) {
        allowed.add(parsed.origin);
      }
    } catch (e) {
      // Ignore invalid URL, do not allow arbitrary wildcards
    }
  }

  return allowed;
}

function isOriginAllowed(originHeader, allowedOrigins) {
  if (!originHeader || typeof originHeader !== 'string') return false;
  try {
    const parsed = new URL(originHeader);
    if (allowedOrigins.has(parsed.origin)) {
      return true;
    }
    // Localhost allowed ONLY outside production
    if (!isProductionEnv()) {
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// --- 2. Rate Limiting (In-Memory Serverless Abuse Layer) ---
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const MAX_RATE_LIMIT_ENTRIES = 1000;

// In-memory map: IP -> { count: number, resetTime: number }
const ipRateLimitMap = new Map();

function cleanExpiredRateLimits(now) {
  for (const [ip, record] of ipRateLimitMap.entries()) {
    if (now > record.resetTime) {
      ipRateLimitMap.delete(ip);
    }
  }
}

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkRateLimit(clientIp) {
  const now = Date.now();

  if (ipRateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    cleanExpiredRateLimits(now);
    while (ipRateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = ipRateLimitMap.keys().next().value;
      if (oldestKey) ipRateLimitMap.delete(oldestKey);
      else break;
    }
  }

  let record = ipRateLimitMap.get(clientIp);
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
    ipRateLimitMap.set(clientIp, record);
    return { allowed: true, resetTime: record.resetTime };
  }

  if (record.count >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return { allowed: false, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, resetTime: record.resetTime };
}

// --- 3. Request Body Hardening ---
const MAX_PAYLOAD_BYTES = 50000; // 50 KB

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const err = new Error('unsupported_media_type');
      err.statusCode = 415;
      return reject(err);
    }

    // Pre-parsed object (framework middleware)
    if (req.body && typeof req.body === 'object') {
      if (Array.isArray(req.body)) {
        const err = new Error('invalid_payload_format');
        err.statusCode = 400;
        return reject(err);
      }
      try {
        const serialized = JSON.stringify(req.body);
        if (serialized.length > MAX_PAYLOAD_BYTES) {
          const err = new Error('payload_too_large');
          err.statusCode = 413;
          return reject(err);
        }
      } catch (e) {
        const err = new Error('malformed_json');
        err.statusCode = 400;
        return reject(err);
      }
      return resolve(req.body);
    }

    // Pre-parsed string
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > MAX_PAYLOAD_BYTES) {
        const err = new Error('payload_too_large');
        err.statusCode = 413;
        return reject(err);
      }
      try {
        const parsed = JSON.parse(req.body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          const err = new Error('invalid_payload_format');
          err.statusCode = 400;
          return reject(err);
        }
        return resolve(parsed);
      } catch (e) {
        const err = new Error('malformed_json');
        err.statusCode = 400;
        return reject(err);
      }
    }

    // Stream parsing
    if (typeof req.on === 'function') {
      let data = '';
      let totalBytes = 0;
      let settled = false;

      const cleanup = () => {
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
      };

      const onData = (chunk) => {
        if (settled) return;
        totalBytes += chunk.length;
        if (totalBytes > MAX_PAYLOAD_BYTES) {
          settled = true;
          cleanup();
          if (typeof req.pause === 'function') req.pause();
          if (typeof req.destroy === 'function') req.destroy();
          const err = new Error('payload_too_large');
          err.statusCode = 413;
          return reject(err);
        }
        data += chunk;
      };

      const onEnd = () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          const parsed = JSON.parse(data || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            const err = new Error('invalid_payload_format');
            err.statusCode = 400;
            return reject(err);
          }
          return resolve(parsed);
        } catch (e) {
          const err = new Error('malformed_json');
          err.statusCode = 400;
          return reject(err);
        }
      };

      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const err = new Error('stream_error');
        err.statusCode = 400;
        return reject(err);
      };

      req.on('data', onData);
      req.on('end', onEnd);
      req.on('error', onError);
      return;
    }

    const err = new Error('missing_body');
    err.statusCode = 400;
    return reject(err);
  });
}

// --- 4. Visitor Confirmation Email Template & Asset Resolver ---
function resolveMonogramAsset() {
  const candidatePaths = [
    path.join(__dirname, '..', 'assets', 'ss-monogram.png'),
    path.join(process.cwd(), 'assets', 'ss-monogram.png')
  ];
  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {}
  }
  return null;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildConfirmationHtml(firstName, hasMonogram) {
  const safeFirstName = escapeHtml(firstName);
  const headerImageCell = hasMonogram
    ? `<td style="vertical-align:middle;padding-right:12px;"><img src="cid:ss-monogram@savvystudio.cc" alt="Savvy Studio" width="34" height="34" style="display:block;width:34px;height:34px;border:0;outline:none;" /></td>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>We've received your inquiry — Savvy Studio</title>
</head>
<body style="margin:0;padding:0;background-color:#07070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0ece8;line-height:1.6;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#07070a;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;text-align:left;">
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  ${headerImageCell}
                  <td style="vertical-align:middle;">
                    <span style="font-size:11px;letter-spacing:0.2em;color:#e3bfa4;font-weight:600;text-transform:uppercase;">SAVVY STUDIO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-size:15px;line-height:1.65;color:#f0ece8;padding-bottom:16px;">
              Hi ${safeFirstName},
            </td>
          </tr>
          <tr>
            <td style="font-size:14px;line-height:1.65;color:rgba(240,232,226,0.85);padding-bottom:14px;">
              Thank you for reaching out to Savvy Studio.
            </td>
          </tr>
          <tr>
            <td style="font-size:14px;line-height:1.65;color:rgba(240,232,226,0.85);padding-bottom:14px;">
              We've received your inquiry and will review the details shortly.
            </td>
          </tr>
          <tr>
            <td style="font-size:14px;line-height:1.65;color:rgba(240,232,226,0.85);padding-bottom:28px;">
              You'll hear from Savvy Studio soon.
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid rgba(226,205,190,0.15);padding-top:20px;font-size:12px;line-height:1.6;color:rgba(226,205,190,0.6);">
              <div style="color:#e3bfa4;font-size:12px;font-weight:500;letter-spacing:0.05em;margin-bottom:4px;">Savvy Studio</div>
              <div><a href="mailto:hello@savvystudio.cc" style="color:rgba(226,205,190,0.7);text-decoration:none;">hello@savvystudio.cc</a></div>
              <div><a href="https://savvystudio.cc" style="color:rgba(226,205,190,0.7);text-decoration:none;">https://savvystudio.cc</a></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Exported handler
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // 1. Origin & Referer Verification
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const isProd = isProductionEnv();
  const allowedOrigins = getAllowedOrigins();

  // In production, require at least one valid Origin or Referer header
  if (isProd) {
    if (!origin && !referer) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
  }

  if (origin && !isOriginAllowed(origin, allowedOrigins)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  if (referer && !isOriginAllowed(referer, allowedOrigins)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  // 2. Client Rate Limiting
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateCheck.resetTime - Date.now()) / 1000));
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ ok: false, error: 'too_many_requests' });
  }

  // 3. Body Parsing & Size Hardening
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ ok: false, error: err.message || 'invalid_body' });
  }

  // Honeypot check: reject if honeypot field is filled
  const honeypot = (body.website || body.honeypot || '').toString().trim();
  if (honeypot.length > 0) {
    return res.status(400).json({ ok: false, error: 'invalid_submission' });
  }

  // Server-side validation
  const source = (body.source || '').toString().trim();
  if (source !== 'direct' && source !== 'diagnostic') {
    return res.status(400).json({ ok: false, error: 'invalid_source' });
  }

  const name = (body.name || '').toString().trim();
  if (!name || name.length > 150) {
    return res.status(400).json({ ok: false, error: 'invalid_name' });
  }

  const email = (body.email || '').toString().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || email.length > 254 || !emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  const brief = (body.brief || '').toString().trim();
  if (!brief || brief.length > 5000) {
    return res.status(400).json({ ok: false, error: 'invalid_brief' });
  }

  const phone = (body.phone || '').toString().trim().slice(0, 50);
  const business = (body.business || '').toString().trim().slice(0, 150);
  const diagnosticDirection = (body.diagnosticDirection || '').toString().trim().slice(0, 150);
  const diagnosticAnswers = (body.diagnosticAnswers || '').toString().trim().slice(0, 2000);
  const submittedAt = (body.submittedAt || new Date().toISOString()).toString().trim().slice(0, 50);

  // Generate unique submission ID for tracing and idempotency
  const inquiryId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'inq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  // 4. Primary Event: Submit to Formspree notification/archive layer
  const formspreeData = new FormData();
  formspreeData.append('inquiryId', inquiryId);
  formspreeData.append('source', source);
  formspreeData.append('name', name);
  formspreeData.append('email', email);
  formspreeData.append('phone', phone);
  formspreeData.append('business', business);
  formspreeData.append('brief', brief);
  formspreeData.append('diagnosticDirection', diagnosticDirection);
  formspreeData.append('diagnosticAnswers', diagnosticAnswers);
  formspreeData.append('submittedAt', submittedAt);

  let formspreeRes;
  try {
    formspreeRes = await fetch('https://formspree.io/f/maeygovz', {
      method: 'POST',
      body: formspreeData,
      headers: {
        Accept: 'application/json'
      }
    });
  } catch (err) {
    console.error(`[inquiry:${inquiryId}] Formspree network failure`);
    return res.status(502).json({ ok: false, error: 'submission_failed' });
  }

  if (!formspreeRes || !formspreeRes.ok) {
    console.error(`[inquiry:${inquiryId}] Formspree responded with status ${formspreeRes ? formspreeRes.status : 'unknown'}`);
    return res.status(502).json({ ok: false, error: 'submission_failed' });
  }

  // 5. Secondary Event: Visitor SMTP confirmation
  let confirmationEmailSent = false;
  const EXPECTED_MAILBOX = 'hello@savvystudio.cc';
  const smtpUser = process.env.PRIVATE_EMAIL_USER || EXPECTED_MAILBOX;
  const smtpPass = process.env.PRIVATE_EMAIL_PASSWORD;

  if (!smtpPass) {
    // Lead is safely received by Formspree. Log missing SMTP configuration without failing the inquiry.
    console.warn(`[inquiry:${inquiryId}] SMTP password not configured in environment; skipping visitor confirmation`);
  } else {
    try {
      const transporter = nodemailer.createTransport({
        host: 'mail.privateemail.com',
        port: 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 2000,
        greetingTimeout: 2000,
        socketTimeout: 3000
      });

      const firstName = name.split(/\s+/)[0] || 'there';
      const emailBody = [
        `Hi ${firstName},`,
        '',
        'Thank you for reaching out to Savvy Studio.',
        '',
        "We've received your inquiry and will review the details shortly.",
        '',
        "You'll hear from Savvy Studio soon.",
        '',
        'Savvy Studio',
        'hello@savvystudio.cc',
        'https://savvystudio.cc'
      ].join('\n');

      const monogramPath = resolveMonogramAsset();
      const hasMonogram = Boolean(monogramPath);

      const attachments = [];
      if (hasMonogram) {
        attachments.push({
          filename: 'ss-monogram.png',
          path: monogramPath,
          cid: 'ss-monogram@savvystudio.cc'
        });
      }

      const mailOptions = {
        from: `Savvy Studio <${EXPECTED_MAILBOX}>`,
        to: email,
        replyTo: EXPECTED_MAILBOX,
        subject: "We've received your inquiry — Savvy Studio",
        text: emailBody,
        html: buildConfirmationHtml(firstName, hasMonogram),
        attachments
      };

      // Bounded secondary delivery: single fast attempt to keep endpoint responsive
      const MAX_SMTP_ATTEMPTS = 1;
      for (let attempt = 1; attempt <= MAX_SMTP_ATTEMPTS; attempt++) {
        try {
          await transporter.sendMail(mailOptions);
          confirmationEmailSent = true;
          break;
        } catch (smtpErr) {
          const sanitizedErr = smtpErr && (smtpErr.code || smtpErr.message || 'unknown');
          console.error(`[inquiry:${inquiryId}] SMTP delivery failed: ${sanitizedErr}`);
        }
      }
    } catch (setupErr) {
      console.error(`[inquiry:${inquiryId}] SMTP setup error: ${setupErr.message || 'unknown'}`);
    }
  }

  // Once Formspree accepts the lead, always return success to the browser
  return res.status(200).json({
    ok: true,
    confirmationEmailSent,
    inquiryId
  });
};
