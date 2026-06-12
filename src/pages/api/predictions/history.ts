import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const trainId = url.searchParams.get('trainId');

    let query = 'SELECT p.* FROM predictions p';
    const params: any[] = [];

    if (trainId) {
      query += ' WHERE p.train_id = ?';
      params.push(trainId);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const predictions = db.prepare(query).all(...params);

    const countQuery = trainId
      ? db.prepare('SELECT COUNT(*) as total FROM predictions WHERE train_id = ?').get(trainId) as any
      : db.prepare('SELECT COUNT(*) as total FROM predictions').get() as any;

    return new Response(JSON.stringify({
      predictions,
      total: countQuery.total,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
