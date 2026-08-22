import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../lib/db';

export const prerender = false;

// GET /api/baseline → latest persisted baseline (plus recent list), or specific baseline by ?id=
export const GET: APIRoute = async ({ url }) => {
  try {
    const db = getDb();
    if (!db) {
      return json({ latest: null, recent: [], persisted: false }, 200);
    }
    const id = url.searchParams.get('id');
    if (id) {
      const row = db.prepare('SELECT snapshot_json FROM baselines WHERE baseline_id = ?').get(id) as any;
      return json({
        baseline: row ? JSON.parse(row.snapshot_json) : null,
        persisted: true,
      }, 200);
    }
    const rows = db.prepare(
      'SELECT baseline_id, name, source, captured_at FROM baselines ORDER BY captured_at DESC LIMIT 10'
    ).all() as any[];
    const latestRow = db.prepare(
      'SELECT snapshot_json FROM baselines ORDER BY captured_at DESC LIMIT 1'
    ).get() as any;
    return json({
      latest: latestRow ? JSON.parse(latestRow.snapshot_json) : null,
      recent: rows,
      persisted: true,
    }, 200);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

// POST /api/baseline → persist a captured baseline snapshot
export const POST: APIRoute = async ({ request }) => {
  try {
    const snapshot = await request.json();
    if (!snapshot?.id || !snapshot?.capturedAt || !Array.isArray(snapshot?.trains)) {
      return json({ error: 'Invalid baseline snapshot' }, 400);
    }
    const db = getDb();
    if (!db) {
      // Vercel /tmp may be cold — the client keeps its own copy, so this is non-fatal.
      return json({ persisted: false }, 200);
    }
    db.prepare(
      'INSERT OR REPLACE INTO baselines (baseline_id, name, source, snapshot_json, captured_at) VALUES (?, ?, ?, ?, ?)'
    ).run(snapshot.id, snapshot.name || 'Baseline', snapshot.source || 'manual', JSON.stringify(snapshot), snapshot.capturedAt);
    logAudit('baseline_captured', {
      baselineId: snapshot.id,
      name: snapshot.name,
      source: snapshot.source,
      trains: snapshot.trains.length,
    });
    return json({ persisted: true, id: snapshot.id }, 201);
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
