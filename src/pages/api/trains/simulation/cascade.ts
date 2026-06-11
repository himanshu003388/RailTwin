import type { APIRoute } from 'astro';
import { runCascadeSimulation } from '../../../../lib/train-engine';
import { getDb, logAudit } from '../../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
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

    try {
      const db = getDb();
      db.prepare(
        'INSERT INTO scenarios (name, station, scenario_type, result_json) VALUES (?, ?, ?, ?)'
      ).run(
        `${scenario} at ${stationId}`,
        stationId,
        scenario,
        JSON.stringify(result)
      );
      logAudit('simulation', { stationId, scenario, ...result });
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
