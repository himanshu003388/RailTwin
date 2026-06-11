import type { APIRoute } from 'astro';
import { getTrainSchedule } from '../../../../lib/train-engine';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const trainId = params.id;
    if (!trainId) {
      return new Response(JSON.stringify({ error: 'Train ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => { query[key] = value; });

    const schedule = getTrainSchedule(trainId, query);
    if (!schedule) {
      return new Response(JSON.stringify({ error: 'Schedule not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(schedule), {
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
