import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../lib/db';

export const prerender = false;

// GET /api/reconciliation → resolution history (operator decisions audit trail)
export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    if (!db) return json({ resolutions: [], persisted: false }, 200);
    const rows = db.prepare(
      'SELECT item_id, item_type, entity, field, resolution, resolved_at FROM reconciliations ORDER BY resolved_at DESC LIMIT 50'
    ).all();
    return json({ resolutions: rows, persisted: true }, 200);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

// POST /api/reconciliation → record an operator's resolution of a conflict
export const POST: APIRoute = async ({ request }) => {
  try {
    const { item, resolution } = await request.json();
    if (!item?.id || !item?.type || !resolution) {
      return json({ error: 'item and resolution are required' }, 400);
    }
    const valid = ['accept-live', 'keep-baseline', 'merge'];
    if (!valid.includes(resolution)) {
      return json({ error: `resolution must be one of ${valid.join(', ')}` }, 400);
    }
    const db = getDb();
    if (db) {
      db.prepare(
        'INSERT INTO reconciliations (item_id, item_type, entity, field, resolution, item_json) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(item.id, item.type, item.entity || '', item.field || '', resolution, JSON.stringify(item));
    }
    logAudit('reconciliation_resolved', {
      itemId: item.id,
      type: item.type,
      entity: item.entity,
      field: item.field,
      resolution,
    });
    return json({ success: true, persisted: !!db }, 201);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
