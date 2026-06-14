# RailTwin AI — Known Limitations

## Weather
- OpenWeatherMap API key must be set via `OPENWEATHER_API_KEY` env var (no frontend input).
- Falls back to Open-Meteo (free, no key needed), then to seasonal heuristics.
- In-memory cache resets per Vercel serverless instance — each cold start fetches fresh weather.

## Gemini AI Copilot
- Default model: `gemini-2.0-flash` (configurable via `GEMINI_MODEL` env var).
- Fallback model: `gemini-2.5-flash` used when primary is rate-limited.
- No server key configured? Users can bring their own key via Settings → Gemini API Key.
- Rate limits apply on free tier — the app shows a friendly message when exhausted.

## Train Positions
- Position interpolation assumes constant speed between stations — not exact real-time IRCTC data.
- Live IRCTC feed requires a RapidAPI key (set via Settings). Without it, simulated positions run.
- Trains snap to track positions every 2 seconds (no smooth animation) — deliberate to avoid map-pan float.

## Data Files
- Historical delay records (`data/historical_delays.json`) include entries for train 12245 (removed) — unused records are ignored.
- Station coordinates approximate; some are shifted slightly for visual clarity on the map.
- No authentication or user accounts — single-operator dashboard.

## Deployment
- SQLite (`better-sqlite3`) requires native build step on Vercel. Data persists in `/tmp` only.
- Map tiles load from CARTO CDN — requires internet. Falls back to MapLibre demo tiles.

## Browser Compatibility
- MapLibre GL JS v4.3 requires a recent Chromium/Firefox/Safari.
- CSS `backdrop-filter` and `animation` features may degrade on older browsers.
- Mobile: bottom nav bar hides at 1024+px; sidebar slides in from left/right.
