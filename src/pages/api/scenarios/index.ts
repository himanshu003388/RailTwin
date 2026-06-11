import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../lib/db';
import { authenticate } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const scenarios = db.prepare(
      'SELECT s.*, o.display_name as creator_name FROM scenarios s LEFT JOIN operators o ON s.created_by = o.id ORDER BY s.created_at DESC LIMIT 50'
    ).all();

    return new Response(JSON.stringify(scenarios), {
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = authenticate(request);
    const { name, station, scenarioType, result } = await request.json();

    if (!name || !station || !scenarioType || !result) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDb();
    const info = db.prepare(
      'INSERT INTO scenarios (name, station, scenario_type, result_json, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(name, station, scenarioType, JSON.stringify(result), user?.userId || null);

    if (user) logAudit('create_scenario', user.userId, { name, station, scenarioType });

    return new Response(JSON.stringify({ id: info.lastInsertRowid, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
