import type { APIRoute } from 'astro';
import { authenticate, logout } from '../../../lib/auth';
import { logAudit } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = authenticate(request);
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.slice(7) || '';

    if (user) {
      logout(token);
      logAudit('logout', user.userId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Logout failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
