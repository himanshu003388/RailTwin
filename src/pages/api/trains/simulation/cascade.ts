import type { APIRoute } from 'astro';
import { runCascadeSimulation } from '../../../../lib/train-engine';
import { getDb, logAudit } from '../../../../lib/db';
import { authenticate } from '../../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = authenticate(request);
    const { stationId, scenario } = await request.json();

    if (!stationId || !scenario) {
      return new Response(JSON.stringify({ error: 'Missing stationId or scenario parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = runCascadeSimulation(stationId, scenario);
    if (!result) {
      return new Response(JSON.stringify({ error: 'Station not found in network' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save scenario to DB
    try {
      const db = getDb();
      db.prepare(
        'INSERT INTO scenarios (name, station, scenario_type, result_json, created_by) VALUES (?, ?, ?, ?, ?)'
      ).run(
        `${scenario} at ${stationId}`,
        stationId,
        scenario,
        JSON.stringify(result),
        user?.userId || null
      );
      if (user) logAudit('simulation', user.userId, { stationId, scenario, ...result });
    } catch (e) {
      console.error('Failed to save scenario:', e);
    }

    return new Response(JSON.stringify(result), {
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
