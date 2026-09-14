const nodemailer = require('nodemailer');

const ALLOWED_HOSTS = new Set([
  'savvystudio.cc',
  'www.savvystudio.cc',
  'localhost',
  '127.0.0.1'
]);

function isAllowedOrigin(originHeader) {
  if (!originHeader) return true;
  try {
    const parsed = new URL(originHeader);
    const host = parsed.hostname;
    if (ALLOWED_HOSTS.has(host) || host.endsWith('.vercel.app')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  if (typeof req.on === 'function') {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 50000) { // Safety ceiling
          resolve({});
        }
      });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
      req.on('error', () => resolve({}));
    });
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if ((origin && !isAllowedOrigin(origin)) || (referer && !isAllowedOrigin(referer))) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const body = await parseRequestBody(req);

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

  // 1. Submit to Formspree archive/notification layer
  const formspreeData = new FormData();
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
    return res.status(502).json({ ok: false, error: 'archive_network_failed' });
  }

  if (!formspreeRes || !formspreeRes.ok) {
    return res.status(502).json({ ok: false, error: 'archive_failed' });
  }

  // 2. Private Email SMTP confirmation to visitor
  const smtpUser = process.env.PRIVATE_EMAIL_USER;
  const smtpPass = process.env.PRIVATE_EMAIL_PASSWORD;

  if (!smtpUser || !smtpPass) {
    // Fail closed: credentials must be set in Vercel environment
    return res.status(500).json({ ok: false, error: 'smtp_not_configured' });
  }

  const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
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

  try {
    await transporter.sendMail({
      from: 'Savvy Studio <hello@savvystudio.cc>',
      to: email,
      replyTo: 'hello@savvystudio.cc',
      subject: "We've received your inquiry — Savvy Studio",
      text: emailBody
    });
  } catch (smtpErr) {
    return res.status(500).json({ ok: false, error: 'delivery_failed' });
  }

  return res.status(200).json({ ok: true });
};
