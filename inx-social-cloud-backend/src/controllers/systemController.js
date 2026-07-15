const { z } = require('zod');
const emailService = require('../services/emailService');
const stripeService = require('../services/stripeService');

async function status(req, res) {
  let smtp = { configured: emailService.isConfigured(), verified: false };
  if (smtp.configured) {
    try { smtp = await emailService.verifyConnection(); }
    catch (error) { smtp = { configured: true, verified: false, message: error.message }; }
  }
  res.json({ smtp, stripe: { configured: stripeService.isConfigured() } });
}

async function testEmail(req, res, next) {
  try {
    const { to } = z.object({ to: z.string().email() }).parse(req.body);
    await emailService.sendTestEmail(to, req.user.id);
    res.json({ ok: true, message: 'Test email sent' });
  } catch (error) { next(error); }
}

module.exports = { status, testEmail };
