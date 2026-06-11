import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../lib/db';
import { authenticate } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    const db = getDb();
    const scenario = db.prepare(
      'SELECT s.*, o.display_name as creator_name FROM scenarios s LEFT JOIN operators o ON s.created_by = o.id WHERE s.id = ?'
    ).get(id);

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

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const user = authenticate(request);
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
    if (user) logAudit('delete_scenario', user.userId, { id: Number(id) });

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
