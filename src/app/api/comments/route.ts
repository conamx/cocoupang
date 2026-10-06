import { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema, useDb } from '@/db/client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? '';
  const id = searchParams.get('id') ?? '';
  if (!type || !id) return Response.json({ error: 'missing params' }, { status: 400 });
  if (!useDb()) return Response.json({ comments: [], demo: true });

  const rows = await db()
    .select()
    .from(schema.comments)
    .where(and(eq(schema.comments.targetType, type), eq(schema.comments.targetId, id)))
    .orderBy(desc(schema.comments.createdAt))
    .limit(100);

  return Response.json({
    comments: rows.map((r) => ({
      id: r.id,
      nickname: r.nickname ?? '익명',
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    id?: string;
    nickname?: string;
    body?: string;
  };
  const text = (body.body ?? '').trim();
  if (!body.type || !body.id || !text) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (text.length > 1000) return Response.json({ error: 'too long' }, { status: 400 });
  if (!useDb()) return Response.json({ ok: true, demo: true });

  const nickname = (body.nickname ?? '').trim().slice(0, 20) || null;
  const [row] = await db()
    .insert(schema.comments)
    .values({ targetType: body.type, targetId: body.id, nickname, body: text })
    .returning();

  return Response.json({
    ok: true,
    comment: {
      id: row.id,
      nickname: row.nickname ?? '익명',
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
