import { getUserById, incrementScansThisMonth } from '../db/queries/users';

export async function checkUsageLimit(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  if (user.plan === 'pro') return true;
  return user.scans_this_month < user.scan_limit_per_month;
}

export async function recordScan(userId: string): Promise<void> {
  await incrementScansThisMonth(userId);
}
