import jwt from 'jsonwebtoken';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
  return process.env.JWT_SECRET;
};

export function signJwt(payload: { userId: string }): string {
  return jwt.sign(payload, secret(), { expiresIn: '30d' });
}

export function verifyJwt(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, secret()) as { userId: string };
  } catch {
    return null;
  }
}
