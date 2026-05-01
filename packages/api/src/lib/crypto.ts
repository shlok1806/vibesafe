import { createHash, randomBytes } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return `vibesafe_${randomBytes(32).toString('hex')}`;
}

export function generateState(): string {
  return randomBytes(16).toString('hex');
}
