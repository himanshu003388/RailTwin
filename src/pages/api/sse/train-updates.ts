import type { APIRoute } from 'astro';
import { getTrains } from '../../../lib/train-engine';

export const prerender = false;

export const GET: APIRoute = async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let active = true;

      const send = () => {
        if (!active) return;
        try {
          const trains = getTrains();
          // Add slight random variation to simulate live movement
          const liveTrains = trains.map(t => ({
            ...t,
            speed: t.speed + Math.round((Math.random() - 0.5) * 10),
            routeProgress: Math.min(1, Math.max(0, t.routeProgress + (Math.random() - 0.5) * 0.02))
          }));
          const data = `data: ${JSON.stringify({ trains: liveTrains, timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          console.error('SSE error:', err);
        }
      };

      // Send initial data immediately
      send();

      // Send updates every 5 seconds
      const interval = setInterval(send, 5000);

      // Clean up after 5 minutes (prevent memory leaks)
      setTimeout(() => {
        active = false;
        clearInterval(interval);
        controller.close();
      }, 300000);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
};
