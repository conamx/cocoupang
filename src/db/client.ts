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
  // 빌드 때 여러 작업자가 동시에 접속하므로 작업자당 연결 수를 줄이고, 막히면 오래 기다리지 않게
  const client = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15 });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
export const useDb = () => (process.env.DATA_SOURCE ?? 'seed') === 'db';
