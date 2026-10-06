import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Postgres 연결 (운영: DATA_SOURCE=db).
// 모듈 로드만으로 연결을 만들지 않도록 지연 초기화합니다.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (DATA_SOURCE=db 인데 DB 주소가 없습니다)');
  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
export const useDb = () => (process.env.DATA_SOURCE ?? 'seed') === 'db';
