import { db } from '../client';
import { User } from '@vibesafe/shared';

export async function upsertUser(params: {
  github_id: number;
  github_login: string;
  github_avatar_url: string;
  email?: string;
}): Promise<User> {
  const { rows } = await db.query<User>(
    `INSERT INTO users (github_id, github_login, github_avatar_url, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id) DO UPDATE SET
       github_login      = EXCLUDED.github_login,
       github_avatar_url = EXCLUDED.github_avatar_url,
       email             = COALESCE(EXCLUDED.email, users.email),
       updated_at        = NOW()
     RETURNING *`,
    [params.github_id, params.github_login, params.github_avatar_url, params.email ?? null],
  );
  return rows[0];
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function incrementScansThisMonth(userId: string): Promise<void> {
  await db.query(
    'UPDATE users SET scans_this_month = scans_this_month + 1, updated_at = NOW() WHERE id = $1',
    [userId],
  );
}

export async function resetMonthlyScans(): Promise<void> {
  await db.query('UPDATE users SET scans_this_month = 0, updated_at = NOW()');
}
