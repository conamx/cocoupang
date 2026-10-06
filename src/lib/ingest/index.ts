import type { RawDeal } from './types';
import { sourceAdapters as adapters } from './sources';
import { db, schema, useDb } from '@/db/client';

const FALLBACK_THUMB = '/placeholder.svg';

export type IngestResult = {
  fetched: number;
  inserted: number;
  bySource: Record<string, number>;
  errors: string[];
  written: boolean;
};

export async function ingestDeals(): Promise<IngestResult> {
  const errors: string[] = [];
  const bySource: Record<string, number> = {};
  const all: RawDeal[] = [];

  for (const a of adapters) {
    try {
      const deals = await a.fetchDeals();
      bySource[a.name] = deals.length;
      all.push(...deals);
    } catch (e) {
      errors.push(`${a.name}: ${(e as Error).message}`);
    }
  }

  // URL 기준 중복 제거
  const seen = new Set<string>();
  const unique = all.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));

  // 시드 모드에서는 쓰지 않고 파싱 결과만 반환(미리보기).
  if (!useDb()) {
    return { fetched: unique.length, inserted: 0, bySource, errors, written: false };
  }

  let inserted = 0;
  const d = db();
  for (const deal of unique) {
    const id = `${deal.source}-${deal.sourceId}`;
    const r = await d
      .insert(schema.deals)
      .values({
        id,
        title: deal.title,
        source: deal.source,
        category: deal.category,
        price: deal.price,
        thumb: deal.thumb ?? FALLBACK_THUMB,
        url: deal.url,
        postedAt: new Date(deal.postedAt),
      })
      .onConflictDoNothing()
      .returning({ id: schema.deals.id });
    if (r.length) inserted++;
  }

  return { fetched: unique.length, inserted, bySource, errors, written: true };
}
