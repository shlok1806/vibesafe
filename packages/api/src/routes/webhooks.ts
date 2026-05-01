import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

const router = Router();

// Raw body needed for HMAC signature verification — must be mounted before express.json()
const rawBody = (() => {
  const express = require('express');
  return express.raw({ type: 'application/json' });
})();

router.use(rawBody);

function verifySignature(body: Buffer, signature: string | undefined): boolean {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) return false;
  const expected = `sha256=${createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

router.post('/github', async (req: Request, res: Response) => {
  const sig   = req.headers['x-hub-signature-256'] as string | undefined;
  const event = req.headers['x-github-event'] as string;
  const body  = req.body as Buffer;

  if (!verifySignature(body, sig)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  if (event === 'pull_request') {
    const payload = JSON.parse(body.toString());
    const action  = payload.action as string;

    if (action === 'opened' || action === 'synchronize') {
      // Full GitHub App analysis will be wired up here
      console.log(`[webhook] PR #${payload.pull_request?.number} ${action} in ${payload.repository?.full_name}`);
    }
  }

  return res.json({ ok: true });
});

export default router;
