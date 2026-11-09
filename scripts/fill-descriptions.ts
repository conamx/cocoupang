/**
 * 상품 소개글 자동 작성 (서버에서, 배포·넷리파이 크레딧 없이 DB 에 바로 저장).
 *
 * 품질 우선:
 *  - 한 번에 최대 3개만 씀 (많이 몰아 쓰면 틀에 박힌 문장이 늘어남)
 *  - 상품명만이 아니라 카테고리·같이 검색된 키워드·다른 옵션 이름까지 줘서 상품마다 다른 글
 *  - 저장 전 자동 검사: 길이, 상투적인 표현, 상품명·옵션에 없는 숫자(지어낸 사양) → 한 번 다시 쓰고, 또 안 되면 건너뜀
 *  - 소개가 없는 상품에만 저장 (매크로가 먼저 쓴 소개는 건드리지 않음)
 * 사이트에는 상품 페이지가 하루 한 번 새로 만들어질 때 나타남.
 *
 * GEMINI_API_KEY 필요 (GitHub 저장소 Settings → Secrets → Actions). 모델: GEMINI_MODELS (쉼표로, 앞에서부터 사용)
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

type Item = { id: string; name: string; category: string; tags: string[]; options: string[] };
type Result = { intro: string; faq: { q: string; a: string }[] };

// 무료 사용량은 모델마다 따로(하루 20회 정도) → 최신 Flash 모델부터 돌아가며 사용, 다 쓴 모델은 몇 시간 쉼
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-2.5-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const REST_HOURS = 4;

class GeminiLimit extends Error {}
class GeminiBusy extends Error {} // 일시적으로 바쁨(5xx) → 다음 모델로

async function restingModels(): Promise<Set<string>> {
  await db().execute(sql`CREATE TABLE IF NOT EXISTS sync_state (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now())`);
  const rows = (await db().execute(
    sql`SELECT key FROM sync_state WHERE key LIKE 'gemini_rest:%' AND value::timestamptz > now()`,
  )) as unknown as { key: string }[];
  return new Set(rows.map((r) => r.key.slice('gemini_rest:'.length)));
}

async function rest(model: string) {
  const until = new Date(Date.now() + REST_HOURS * 3_600_000).toISOString();
  await db().execute(sql`
    INSERT INTO sync_state (key, value, updated_at) VALUES (${'gemini_rest:' + model}, ${until}::text, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`);
}

/** 쓸 수 있는 모델로 호출, 사용량이 다 찬 모델은 쉬게 하고 다음 모델로. 모두 찼으면 GeminiLimit */
async function gemini(prompt: string): Promise<string> {
  const resting = await restingModels();
  for (const model of MODELS) {
    if (resting.has(model)) continue;
    try {
      return await geminiOnce(model, prompt);
    } catch (e) {
      if (e instanceof GeminiLimit) {
        await rest(model);
        continue;
      }
      if (e instanceof GeminiBusy) continue;
      throw e;
    }
  }
  throw new GeminiLimit('쓸 수 있는 모델 없음 (무료 사용량 소진 또는 모두 바쁨)');
}

async function geminiOnce(model: string, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY 없음');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
    }),
  });
  const text = await res.text();
  if (res.status === 429) throw new GeminiLimit(`gemini 429: ${text.slice(0, 160)}`);
  if (res.status >= 500) throw new GeminiBusy(`gemini ${model} ${res.status}`);
  if (!res.ok) throw new Error(`gemini ${model} ${res.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

const PROMPT = `너는 쇼핑 정보 사이트에서 상품 설명을 쓰는 사람이야. 아래 쿠팡 상품마다 '상품 소개'와 '자주 묻는 질문'을 써줘.

[쓸 내용]
- intro: 2~4문장, 120~260자. 이 상품이 무엇인지 → 상품명·옵션에 나온 구체적인 정보(용량, 수량, 규격, 구성, 호환 등) → 어떤 사람·상황에 맞는지 → 살 때 확인하면 좋은 점.
- faq: 이 상품을 사려는 사람이 실제로 궁금해할 질문 2~3개와 답(답은 1~2문장).
  상품 종류에 맞게 고르기: 식품→보관·조리·섭취, 생활용품→사용법·사이즈·교체주기, PC·가전→호환·설치·연결, 유아용품→월령·안전, 반려동물→급여·연령, 패션→사이즈·소재 확인.

[꼭 지킬 것]
- 주어진 정보(상품명, 옵션, 카테고리, 검색 키워드)에 없는 사실은 쓰지 마. 성분·원산지·성능 수치·인증·효과를 지어내지 마.
  정보가 없으면 "상세페이지에서 확인하세요"처럼 안내해.
- 숫자는 상품명이나 옵션에 나온 숫자만 써. 새 숫자(기간, 온도, 개월 수 등)를 만들지 마.
- 가격·할인·최저가·배송 이야기 금지.
- 이런 상투적인 말 금지: 완벽한, 최고의, 다양한 요리, 다양하게 활용, 행복, 선사, 특별한 경험, 필수템, 강력 추천, 놓치지 마세요, 만족스러운, 고급스러운.
- 광고 문구 말고, 직접 써 본 사람이 담백하게 알려주듯 자연스러운 존댓말(~예요/~입니다). 이모지·마크다운 금지.
- 상품마다 첫 문장 시작을 다르게.

[출력] JSON 배열 하나만, 상품 순서 그대로:
[{"id":"상품ID","intro":"소개","faq":[{"q":"질문","a":"답"}]}]

[상품]
`;

function describeItems(items: Item[]): string {
  return items
    .map(
      (it, i) =>
        `${i + 1}. id=${it.id}\n   상품명: ${it.name}\n   카테고리: ${it.category}` +
        (it.tags.length ? `\n   같이 검색된 키워드: ${it.tags.join(', ')}` : '') +
        (it.options.length ? `\n   같은 상품의 다른 옵션: ${it.options.slice(0, 5).join(' / ')}` : ''),
    )
    .join('\n');
}

const BANNED = ['완벽', '최고의', '다양한 요리', '다양하게 활용', '다양한 용도', '행복', '선사', '특별한 경험', '필수템', '강력 추천', '놓치지', '만족스러운', '고급스러운', '최저가', '할인', '배송'];

/** 저장해도 되는 글인지 검사. 문제가 있으면 이유를 돌려줌 */
function check(r: Result, it: Item): string | null {
  const intro = (r.intro || '').trim();
  if (intro.length < 90 || intro.length > 340) return `소개 길이 ${intro.length}자`;
  const faq = (r.faq || []).filter((f) => f && f.q?.trim().length >= 5 && f.a?.trim().length >= 8);
  if (faq.length < 2) return '질문 2개 미만';
  const all = [intro, ...faq.flatMap((f) => [f.q, f.a])].join(' ');
  const bad = BANNED.find((w) => all.includes(w));
  if (bad) return `상투적 표현 "${bad}"`;
  // 상품명·옵션에 없는 숫자 = 지어낸 사양일 가능성
  const source = [it.name, ...it.options].join(' ').replace(/,/g, '');
  const nums = (all.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => !source.includes(n));
  if (nums.length) return `없는 숫자 ${[...new Set(nums)].join(',')}`;
  if (/[*#`]|https?:/.test(all)) return '서식 기호·링크';
  return null;
}

function compose(r: Result): string {
  const faq = r.faq.filter((f) => f.q?.trim() && f.a?.trim()).slice(0, 3);
  const qa = faq.map((f) => `Q. ${f.q.trim().replace(/^Q\s*[.:)]\s*/, '')}\nA. ${f.a.trim().replace(/^A\s*[.:)]\s*/, '')}`).join('\n');
  return `${r.intro.trim()}\n\n${qa}`;
}

/** 소개가 없는 상품 (많이 볼 상품부터: 골드박스 → 베스트 순위 → 검색 키워드 있는 상품) */
async function pick(limit: number, exclude: Set<string>): Promise<Item[]> {
  const rows = (await db().execute(sql`
    SELECT p.id, p.name, p.category_label AS category, coalesce(p.search_terms, '') AS tags,
      coalesce((SELECT string_agg(DISTINCT o.name, '|') FROM product_options o WHERE o.product_id = p.id AND o.name <> p.name), '') AS options
    FROM products p
    WHERE p.description IS NULL
    ORDER BY (p.source = 'goldbox') DESC, (p.source = 'best') DESC, p.rank ASC NULLS LAST, (p.search_terms IS NOT NULL) DESC, p.updated_at DESC
    LIMIT ${limit + exclude.size}`)) as unknown as { id: string; name: string; category: string; tags: string; options: string }[];
  return rows
    .filter((r) => !exclude.has(r.id))
    .slice(0, limit)
    .map((r) => ({ id: r.id, name: r.name, category: r.category, tags: r.tags.split('|').filter(Boolean), options: r.options.split('|').filter(Boolean) }));
}

async function write(items: Item[], feedback = ''): Promise<Map<string, Result>> {
  const raw = await gemini(PROMPT + describeItems(items) + (feedback ? `\n\n[이전 결과에서 고칠 점]\n${feedback}` : ''));
  const m = raw.match(/\[[\s\S]*\]/);
  const arr = (m ? JSON.parse(m[0]) : []) as (Result & { id?: string })[];
  const out = new Map<string, Result>();
  arr.forEach((r, i) => out.set(String(r.id ?? items[i]?.id), { intro: String(r.intro ?? ''), faq: Array.isArray(r.faq) ? r.faq : [] }));
  return out;
}

/**
 * calls: 이번에 쓸 AI 호출 수 (한 번에 최대 3개 상품). apply=false 면 저장하지 않고 결과만 돌려줌(샘플).
 * 무료 사용량 제한(429)에 걸리면 그 자리에서 멈춤 — 다음 시간에 이어서.
 */
export async function fillDescriptions(calls: number, apply: boolean, perCall = 3) {
  const out = { saved: 0, skipped: 0, calls: 0, samples: [] as { name: string; description: string }[], errors: [] as string[], stopped: '' };
  if (!process.env.GEMINI_API_KEY) return { ...out, stopped: 'GEMINI_API_KEY 없음' };
  const tried = new Set<string>();
  try {
    await db().execute(sql`SELECT 1 FROM product_options LIMIT 1`);
  } catch {
    await db().execute(sql`CREATE TABLE IF NOT EXISTS product_options (product_id text NOT NULL, vendor_item_id text NOT NULL, name text NOT NULL, price integer NOT NULL, first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (product_id, vendor_item_id))`);
  }
  while (out.calls < calls) {
    const items = await pick(perCall, tried);
    if (!items.length) break;
    items.forEach((it) => tried.add(it.id));
    try {
      out.calls++;
      let results = await write(items);
      // 검사에 걸린 상품만 이유를 알려주고 한 번 다시
      const failed = items.filter((it) => { const r = results.get(it.id); return !r || check(r, it); });
      if (failed.length && out.calls < calls) {
        out.calls++;
        const fb = failed.map((it) => `id=${it.id}: ${results.get(it.id) ? check(results.get(it.id)!, it) : '결과 없음'}`).join('\n');
        const again = await write(failed, fb);
        for (const it of failed) if (again.has(it.id)) results.set(it.id, again.get(it.id)!);
      }
      for (const it of items) {
        const r = results.get(it.id);
        const why = r ? check(r, it) : '결과 없음';
        if (!r || why) {
          out.skipped++;
          out.errors.push(`${it.name.slice(0, 20)}: ${why}`);
          continue;
        }
        const description = compose(r);
        if (apply) {
          await db().execute(sql`UPDATE products SET description = ${description} WHERE id = ${it.id} AND description IS NULL`);
          out.saved++;
        } else out.samples.push({ name: it.name, description });
      }
    } catch (e) {
      if (e instanceof GeminiLimit) {
        out.stopped = '제미나이 무료 사용량 모두 소진 — 몇 시간 뒤 이어서';
        break;
      }
      out.errors.push((e as Error).message.slice(0, 160));
    }
    await new Promise((r) => setTimeout(r, 13_000)); // 무료 분당 호출 수(5회) 여유
  }
  out.errors = out.errors.slice(0, 10);
  return out;
}
