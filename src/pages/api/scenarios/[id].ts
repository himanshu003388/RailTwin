import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    const db = getDb();
    const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);

    if (!scenario) {
      return new Response(JSON.stringify({ error: 'Scenario not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(scenario), {
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

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    const db = getDb();

    const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
    if (!scenario) {
      return new Response(JSON.stringify({ error: 'Scenario not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
    logAudit('delete_scenario', { id: Number(id) });

    return new Response(JSON.stringify({ success: true }), {
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
