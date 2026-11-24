import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Postgres 연결 (운영: DATA_SOURCE=db).
// 모듈 로드만으로 연결을 만들지 않도록 지연 초기화합니다.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (DATA_SOURCE=db 인데 DB 주소가 없습니다)');
  // 빌드 때 여러 작업자가 동시에 접속하므로 작업자당 연결 수를 줄이고, 막히면 오래 기다리지 않게
  // fetch_types: false — 연결할 때마다 타입 목록을 읽어 오는 준비 쿼리(왕복 2~3번)를 생략 (배열 타입 안 씀)
  // 연결 수: 수집 작업(GitHub Actions)·빌드는 3개, 상시 서버(오라클)는 요청이 한 프로세스로 몰리므로 12개
  // (11/23 서버 이전 직후 봇이 상품 페이지를 몰아서 요청 → 연결 3개 앞에 줄이 끝없이 길어져 페이지가 멈췄음)
  const max = Number(process.env.DB_POOL_MAX ?? (process.env.GITHUB_ACTIONS || process.env.NEXT_PHASE ? 3 : 12));
  const client = postgres(url, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 15,
    max_lifetime: 60 * 30, // 오래된 연결은 30분마다 새로 (풀러가 조용히 끊은 연결에 매달리지 않게)
    fetch_types: false,
  });
  _client = client;
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * DB 연결을 통째로 버리고 다음 조회 때 새로 만듦.
 * 11/24 확인: 상시 서버에서 연결 12개가 응답 없는 채로 전부 묶여, 캐시 안 된 상세페이지가 영원히 멈췄음
 * (DB 는 0.5초 안에 답하는데 사이트를 재시작하기 전까지 안 풀림). 시간 제한에 걸리면 이걸로 풀어 줌.
 */
export function resetDb() {
  const old = _client;
  _db = null;
  _client = null;
  if (old) old.end({ timeout: 0 }).catch(() => {});
}

/** DB 조회에 시간 제한 — 넘으면 연결을 새로 만들고 오류로 끝냄 (멈춘 채 기다리지 않게) */
export const DB_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS ?? 20000);
export async function withDbTimeout<T>(p: PromiseLike<T>, label = 'db', ms = DB_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      console.error(`[db] ${label} ${ms}ms 안에 응답 없음 → 연결 새로 만듦`);
      resetDb();
      reject(new Error(`DB timeout: ${label}`));
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(p), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export { schema };
export const useDb = () => (process.env.DATA_SOURCE ?? 'seed') === 'db';
