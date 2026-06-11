import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const scenarios = db.prepare(
      'SELECT * FROM scenarios ORDER BY created_at DESC LIMIT 50'
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
    const { name, station, scenarioType, result } = await request.json();

    if (!name || !station || !scenarioType || !result) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDb();
    const info = db.prepare(
      'INSERT INTO scenarios (name, station, scenario_type, result_json) VALUES (?, ?, ?, ?)'
    ).run(name, station, scenarioType, JSON.stringify(result));

    logAudit('create_scenario', { name, station, scenarioType });

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
