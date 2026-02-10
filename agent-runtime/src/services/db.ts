import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

export const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, max: 10 })
  : null;

export async function checkDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
