import { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema, useDb } from '@/db/client';
import { getAnonId } from '@/lib/anon';

async function counts(targetType: string, targetId: string) {
  const d = db();
  const rows = await d
    .select({
      likes: sql<number>`count(*) filter (where ${schema.reactions.value} = 1)`,
      dislikes: sql<number>`count(*) filter (where ${schema.reactions.value} = -1)`,
    })
    .from(schema.reactions)
    .where(and(eq(schema.reactions.targetType, targetType), eq(schema.reactions.targetId, targetId)));
  return { likes: Number(rows[0]?.likes ?? 0), dislikes: Number(rows[0]?.dislikes ?? 0) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get('type') ?? '';
  const targetId = searchParams.get('id') ?? '';
  if (!targetType || !targetId) return Response.json({ error: 'missing params' }, { status: 400 });
  if (!useDb()) return Response.json({ likes: 0, dislikes: 0, mine: 0, demo: true });
  const c = await counts(targetType, targetId);
  return Response.json(c);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    id?: string;
    value?: number;
  };
  const { type, id, value } = body;
  if (!type || !id || (value !== 1 && value !== -1 && value !== 0)) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!useDb()) return Response.json({ likes: 0, dislikes: 0, mine: value ?? 0, demo: true });

  const anonId = await getAnonId();
  const d = db();
  if (value === 0) {
    await d
      .delete(schema.reactions)
      .where(
        and(
          eq(schema.reactions.targetType, type),
          eq(schema.reactions.targetId, id),
          eq(schema.reactions.anonId, anonId),
        ),
      );
  } else {
    await d
      .insert(schema.reactions)
      .values({ targetType: type, targetId: id, anonId, value })
      .onConflictDoUpdate({
        target: [schema.reactions.targetType, schema.reactions.targetId, schema.reactions.anonId],
        set: { value },
      });
  }
  const c = await counts(type, id);
  return Response.json({ ...c, mine: value });
}
