import { Router, Request, Response } from 'express';
import { upsertUser } from '../db/queries/users';
import { signJwt } from '../lib/jwt';
import { generateState } from '../lib/crypto';

const router = Router();

const GITHUB_SCOPES = 'read:user user:email';

router.get('/github', (_req: Request, res: Response) => {
  const state = generateState();
  const params = new URLSearchParams({
    client_id:    process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.API_URL}/api/auth/callback`,
    scope:        GITHUB_SCOPES,
    state,
  });

  // Store state in short-lived cookie for CSRF verification
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000, sameSite: 'lax' });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const storedState = req.cookies?.oauth_state;

  if (!code || !state || state !== storedState) {
    return res.status(400).send('Invalid OAuth state.');
  }

  res.clearCookie('oauth_state');

  try {
    // Exchange code for GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method:  'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return res.status(400).send('GitHub OAuth failed.');
    }

    // Fetch GitHub user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'VibeSafe' },
    });
    const ghUser = await userRes.json() as {
      id: number; login: string; avatar_url: string; email?: string;
    };

    // Fetch email separately if not public
    let email = ghUser.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'VibeSafe' },
      });
      const emails = await emailRes.json() as Array<{ email: string; primary: boolean }>;
      email = emails.find(e => e.primary)?.email;
    }

    const user = await upsertUser({
      github_id:        ghUser.id,
      github_login:     ghUser.login,
      github_avatar_url: ghUser.avatar_url,
      email,
    });

    const jwt = signJwt({ userId: user.id });

    res.cookie('vibesafe_token', jwt, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.redirect(`${process.env.WEB_URL}/dashboard`);
  } catch (err) {
    console.error('Auth callback error:', err);
    return res.status(500).send('Authentication failed.');
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('vibesafe_token');
  res.json({ ok: true });
});

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.vibesafe_token;
  if (!token) return res.json({ user: null });

  const { verifyJwt } = await import('../lib/jwt');
  const { getUserById } = await import('../db/queries/users');
  const payload = verifyJwt(token);
  if (!payload) return res.json({ user: null });

  const user = await getUserById(payload.userId);
  return res.json({ user });
});

export default router;
