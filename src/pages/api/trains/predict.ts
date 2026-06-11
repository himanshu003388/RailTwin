import type { APIRoute } from 'astro';
import { predictDelay } from '../../../lib/train-engine';
import { getDb, logAudit } from '../../../lib/db';
import { authenticate } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = authenticate(request);
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

    // Save prediction to DB
    try {
      const db = getDb();
      db.prepare(
        'INSERT INTO predictions (train_id, predicted_delay, confidence, conditions_json, explanation, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        trainNo,
        result.predictedDelay,
        result.confidence,
        JSON.stringify({ routeLength: length, stationCongestion, weatherCondition, rainfall }),
        result.explanation,
        user?.userId || null
      );
      if (user) logAudit('predict', user.userId, { trainNo, predictedDelay: result.predictedDelay });
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
