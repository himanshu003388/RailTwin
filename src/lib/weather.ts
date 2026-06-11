import { getDb } from './db';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const CACHE_TTL_MINUTES = 15;

interface WeatherData {
  station: string;
  rainfall: number;
  description: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  icon: string;
  fetchedAt: string;
  source: 'live' | 'cache' | 'fallback';
}

const STATION_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  ndls: { lat: 28.6419, lng: 77.2217, name: 'New Delhi' },
  cnb: { lat: 26.4525, lng: 80.3311, name: 'Kanpur Central' },
  ald: { lat: 25.4358, lng: 81.8463, name: 'Prayagraj' },
  bsb: { lat: 25.3180, lng: 83.0090, name: 'Varanasi Junction' },
  pnbe: { lat: 25.6093, lng: 85.1376, name: 'Patna Junction' },
  dhn: { lat: 23.7957, lng: 86.4304, name: 'Dhanbad Junction' },
  hwh: { lat: 22.5804, lng: 88.3460, name: 'Howrah Junction' }
};

const FALLBACK_WEATHER: Record<string, { rainfall: number; description: string }> = {
  ndls: { rainfall: 0, description: 'Clear sky' },
  cnb: { rainfall: 0, description: 'Partly cloudy' },
  ald: { rainfall: 0, description: 'Clear sky' },
  bsb: { rainfall: 0, description: 'Clear sky' },
  pnbe: { rainfall: 72, description: 'Heavy rainfall' },
  dhn: { rainfall: 0, description: 'Partly cloudy' },
  hwh: { rainfall: 0, description: 'Light rain' }
};

function getCachedWeather(stationCode: string): WeatherData | null {
  if (!OPENWEATHER_API_KEY) return null;
  const db = getDb();
  const row = db.prepare(
    "SELECT data_json, fetched_at FROM weather_cache WHERE station_code = ? ORDER BY fetched_at DESC LIMIT 1"
  ).get(stationCode) as any;

  if (!row) return null;

  const fetchedAt = new Date(row.fetched_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - fetchedAt.getTime()) / (1000 * 60);

  if (diffMinutes > CACHE_TTL_MINUTES) return null;

  const data = JSON.parse(row.data_json);
  data.source = 'cache';
  return data;
}

function cacheWeather(stationCode: string, data: WeatherData) {
  if (!OPENWEATHER_API_KEY) return;
  const db = getDb();
  db.prepare('INSERT INTO weather_cache (station_code, data_json) VALUES (?, ?)').run(
    stationCode,
    JSON.stringify(data)
  );
}

async function fetchLiveWeather(stationCode: string): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) return null;

  const coords = STATION_COORDS[stationCode];
  if (!coords) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const rainfall = data.rain?.['1h'] || data.rain?.['3h'] || 0;
    const description = data.weather?.[0]?.description || 'Clear sky';
    const icon = data.weather?.[0]?.icon || '01d';

    const weatherData: WeatherData = {
      station: stationCode,
      rainfall: Math.round(rainfall * 10) / 10,
      description,
      temperature: Math.round(data.main?.temp || 0),
      humidity: data.main?.humidity || 0,
      windSpeed: Math.round((data.wind?.speed || 0) * 3.6),
      visibility: Math.round((data.visibility || 10000) / 1000),
      icon,
      fetchedAt: new Date().toISOString(),
      source: 'live'
    };

    cacheWeather(stationCode, weatherData);
    return weatherData;
  } catch (err) {
    console.error(`Failed to fetch weather for ${stationCode}:`, err);
    return null;
  }
}

export async function getWeatherAlert(): Promise<{
  station: string;
  rainfall: number;
  description: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  source: string;
}> {
  // Check cache first
  const cached = getCachedWeather('pnbe');
  if (cached) {
    return {
      station: cached.station,
      rainfall: cached.rainfall,
      description: cached.description,
      temperature: cached.temperature,
      humidity: cached.humidity,
      windSpeed: cached.windSpeed,
      visibility: cached.visibility,
      source: 'cache'
    };
  }

  // Try live API
  const live = await fetchLiveWeather('pnbe');
  if (live) {
    return {
      station: live.station,
      rainfall: live.rainfall,
      description: live.description,
      temperature: live.temperature,
      humidity: live.humidity,
      windSpeed: live.windSpeed,
      visibility: live.visibility,
      source: 'live'
    };
  }

  // Fallback to hardcoded
  const fallback = FALLBACK_WEATHER.pnbe;
  return {
    station: 'pnbe',
    rainfall: fallback.rainfall,
    description: fallback.description,
    temperature: 28,
    humidity: 85,
    windSpeed: 12,
    visibility: 5,
    source: 'fallback'
  };
}
