import type { APIRoute } from 'astro';
import { predictDelay } from '../../../lib/train-engine';
import { getDb, logAudit } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { trainNo, routeLength, stationCongestion, weatherCondition, rainfall } = await request.json();

    if (!trainNo) {
      return new Response(JSON.stringify({ error: 'Missing trainNo parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const length = Number(routeLength) || 1531;
    const result = predictDelay(
      trainNo,
      length,
      stationCongestion || 'low',
      weatherCondition || 'Clear',
      rainfall ? Number(rainfall) : undefined
    );

    try {
      const db = getDb();
      db.prepare(
        'INSERT INTO predictions (train_id, predicted_delay, confidence, conditions_json, explanation) VALUES (?, ?, ?, ?, ?)'
      ).run(
        trainNo,
        result.predictedDelay,
        result.confidence,
        JSON.stringify({ routeLength: length, stationCongestion, weatherCondition, rainfall }),
        result.explanation
      );
      logAudit('predict', { trainNo, predictedDelay: result.predictedDelay });
    } catch (e) {
      console.error('Failed to save prediction:', e);
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
