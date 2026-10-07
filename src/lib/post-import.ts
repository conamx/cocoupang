/**
 * 정보글(블로그) 대량 등록 — 엑셀 양식/붙여넣기 해석 (관리자 화면·API 공용, 브라우저에서도 동작)
 *
 * 엑셀 양식 열 (첫 줄 = 제목줄, 열 순서 상관없음)
 *   제목*  본문*  요약  카테고리  발행일  주소  상품
 * 제목이 [예시] 로 시작하는 줄은 건너뜀 (양식의 예시 줄)
 *
 * 발행일: 그날 오전 9시(한국시간)부터 사이트·사이트맵에 나타남. 비우면 관리자 화면에서 '하루 N개씩' 자동 배정.
 * 본문 서식: 빈 줄 = 문단 나눔 / '## ' 소제목 / '### ' 작은 소제목 / '- ' 목록 /
 *            한 줄에 [상품:상품ID] → 그 자리에 상품 카드
 */
import type { Post } from '@/lib/types';

export type PostDraft = Omit<Post, 'date'> & { date: string; products: string[] };

export const POST_CATEGORIES = ['쇼핑가이드', '최저가 정보', '제품 비교', '생활 꿀팁', '여행가이드'] as const;
export const DEFAULT_POST_CATEGORY = '쇼핑가이드';

/** 열 이름 → 필드 (양식 제목줄을 조금 다르게 써도 알아보게) */
const HEADERS: Record<keyof Omit<PostDraft, 'products'> | 'products', string[]> = {
  title: ['제목', '글제목', 'title'],
  body: ['본문', '내용', 'body', 'content'],
  summary: ['요약', '설명', '요약(설명)', 'summary', 'description'],
  category: ['카테고리', '분류', 'category'],
  date: ['발행일', '날짜', '예약일', 'date'],
  slug: ['주소', '글주소', 'url', 'slug'],
  products: ['상품', '상품id', '관련상품', 'products'],
};

/** 본문 한 줄짜리 상품 카드 표시: [상품:123456] 또는 [상품:https://.../coupang/123456] */
export const PRODUCT_TAG = /^\[\s*상품\s*[:：]\s*([^\]\s]+)\s*\]$/;

export function productIdOf(v: string): string | undefined {
  const s = v.trim();
  if (/^\d{4,}$/.test(s)) return s;
  return s.match(/\/coupang\/(\d+)/)?.[1] ?? s.match(/\/vp\/products\/(\d+)/)?.[1];
}

/** 탭(엑셀 복사)·쉼표(CSV) 구분 표. 따옴표로 감싼 칸 안의 줄바꿈/구분자도 처리 */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const firstLine = src.split('\n', 1)[0];
  const sep = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const KST = 9 * 3600_000;
export const todayKst = () => new Date(Date.now() + KST).toISOString().slice(0, 10);

/** 발행일 칸 → 'YYYY-MM-DD' (비었거나 못 읽으면 '') . 2026-10-15, 2026.10.15, 2026/10/15, 10/15, 엑셀 날짜 숫자 */
export function normalizeDate(v: string): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    // 엑셀 날짜 일련번호 (1899-12-30 기준)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400_000);
    return d.toISOString().slice(0, 10);
  }
  let m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) {
    const y = +todayKst().slice(0, 4);
    return ymd(y, +m[1], +m[2]);
  }
  return '';
}

function ymd(y: number, mo: number, d: number): string {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return dt.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' 에 n일 더하기 */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 발행일 → DB 저장 시각: 그날 오전 9시(한국) = 00:00 UTC (화면에 보이는 날짜와 같아지도록) */
export const publishAt = (date: string) => new Date(`${date}T00:00:00Z`);

/** 글 주소: 제목 그대로(한글 가능) 띄어쓰기는 -, 특수문자 제거 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** 요약을 비웠을 때: 본문 앞부분(서식 기호·상품 표시 빼고) 120자 */
export function autoSummary(body: string): string {
  const text = body
    .split('\n')
    .filter((l) => !PRODUCT_TAG.test(l.trim()) && !/^#{2,3}\s/.test(l.trim()))
    .map((l) => l.replace(/^\s*-\s+/, '').trim())
    .filter(Boolean)
    .join(' ');
  return text.length > 120 ? `${text.slice(0, 118).trimEnd()}…` : text;
}

/** 표(첫 줄 = 제목줄) → 글 목록 */
export function tableToDrafts(table: string[][]): { drafts: PostDraft[]; problems: string[] } {
  const problems: string[] = [];
  if (table.length < 2) return { drafts: [], problems: ['제목줄과 글이 한 줄 이상 있어야 해요 (엑셀 양식 첫 줄을 지우지 마세요).'] };
  const head = table[0].map((h) => h.replace(/[\s*]/g, '').toLowerCase());
  const col = {} as Record<keyof typeof HEADERS, number>;
  for (const [field, names] of Object.entries(HEADERS) as [keyof typeof HEADERS, string[]][]) {
    col[field] = head.findIndex((h) => names.some((n) => h === n.replace(/\s/g, '').toLowerCase()));
  }
  if (col.title < 0 || col.body < 0) {
    return { drafts: [], problems: ['첫 줄에 "제목"과 "본문" 열이 있어야 해요. 엑셀 양식의 제목줄을 그대로 두세요.'] };
  }
  const get = (r: string[], f: keyof typeof HEADERS) => (col[f] >= 0 ? (r[col[f]] ?? '').trim() : '');

  const drafts: PostDraft[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const title = get(r, 'title');
    const body = get(r, 'body').replace(/\r\n?/g, '\n');
    if (!title && !body) return;
    if (/^\[\s*예시\s*\]/.test(title) || /^▼/.test(title)) return; // 양식의 예시·안내 줄은 지우지 않아도 건너뛴다
    if (!title || !body) {
      problems.push(`${line}번째 줄: ${!title ? '제목' : '본문'}이 비어 있어서 건너뜀`);
      return;
    }
    const rawDate = get(r, 'date');
    const date = normalizeDate(rawDate);
    if (rawDate && !date) problems.push(`${line}번째 줄: 발행일 "${rawDate}"을 못 읽어서 자동 배정으로 둠 (예: 2026-10-15)`);
    let slug = slugify(get(r, 'slug') || title);
    if (!slug) slug = `post-${Date.now().toString(36)}-${i}`;
    if (seen.has(slug)) {
      let n = 2;
      while (seen.has(`${slug}-${n}`)) n++;
      problems.push(`${line}번째 줄: 주소가 앞 글과 같아서 "${slug}-${n}"으로 바꿈`);
      slug = `${slug}-${n}`;
    }
    seen.add(slug);
    const products = get(r, 'products')
      .split(/[,\s]+/)
      .map((v) => (v ? productIdOf(v) : undefined))
      .filter((v): v is string => !!v);
    drafts.push({
      slug,
      title,
      body,
      summary: get(r, 'summary') || autoSummary(body),
      category: get(r, 'category') || DEFAULT_POST_CATEGORY,
      date,
      products,
    });
  });
  return { drafts, problems };
}

/** 발행일이 빈 글에 날짜 배정: start 날짜부터 하루 perDay 개씩 (이미 날짜가 있는 글이 차지한 자리는 피함) */
export function assignDates(drafts: PostDraft[], start: string, perDay: number): PostDraft[] {
  const per = Math.max(1, Math.floor(perDay));
  const used = new Map<string, number>();
  for (const d of drafts) if (d.date) used.set(d.date, (used.get(d.date) ?? 0) + 1);
  let day = start;
  return drafts.map((d) => {
    if (d.date) return d;
    while ((used.get(day) ?? 0) >= per) day = addDays(day, 1);
    used.set(day, (used.get(day) ?? 0) + 1);
    return { ...d, date: day };
  });
}

/** 상품 열에 적은 상품 중 본문에 [상품:ID]로 안 넣은 것은 본문 끝에 '관련 상품'으로 붙인다 */
export function bodyWithProducts(d: Pick<PostDraft, 'body' | 'products'>): string {
  const inBody = new Set(
    d.body
      .split('\n')
      .map((l) => l.trim().match(PRODUCT_TAG)?.[1])
      .map((v) => (v ? productIdOf(v) : undefined))
      .filter(Boolean),
  );
  const rest = d.products.filter((p) => !inBody.has(p));
  if (!rest.length) return d.body;
  return `${d.body.trimEnd()}\n\n## 관련 상품\n\n${rest.map((p) => `[상품:${p}]`).join('\n')}`;
}

export type BodyBlock =
  | { t: 'h2' | 'h3' | 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'products'; ids: string[] };

/** 본문 → 화면 블록 (줄 단위. 붙어 있는 줄은 한 문단, 연속한 상품 표시는 한 줄 카드 묶음) */
export function parseBody(body: string): BodyBlock[] {
  const out: BodyBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: 'p', text: para.join('\n') });
    para = [];
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const tag = line.match(PRODUCT_TAG);
    if (tag) {
      flush();
      const id = productIdOf(tag[1]);
      if (!id) continue;
      const last = out[out.length - 1];
      if (last?.t === 'products') last.ids.push(id);
      else out.push({ t: 'products', ids: [id] });
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      flush();
      out.push({ t: h[1].length === 2 ? 'h2' : 'h3', text: h[2] });
      continue;
    }
    const li = line.match(/^[-*•·]\s+(.+)$/);
    if (li) {
      flush();
      const last = out[out.length - 1];
      if (last?.t === 'ul') last.items.push(li[1]);
      else out.push({ t: 'ul', items: [li[1]] });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}
