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
  source: 'live' | 'cache';
}

const STATION_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  ndls: { lat: 28.6419, lng: 77.2217, name: 'New Delhi' },
  cnb: { lat: 26.4525, lng: 80.3311, name: 'Kanpur Central' },
  ald: { lat: 25.4358, lng: 81.8463, name: 'Prayagraj' },
  pnbe: { lat: 25.6093, lng: 85.1376, name: 'Patna Junction' },
  hwh: { lat: 22.5804, lng: 88.3460, name: 'Howrah Junction' }
};

function getCachedWeather(stationCode: string): WeatherData | null {
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
  const db = getDb();
  db.prepare('INSERT INTO weather_cache (station_code, data_json) VALUES (?, ?)').run(
    stationCode,
    JSON.stringify(data)
  );
}

async function fetchLiveWeather(stationCode: string, apiKey: string): Promise<WeatherData | null> {
  if (!apiKey) return null;

  const coords = STATION_COORDS[stationCode];
  if (!coords) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const rainfall = data.rain?.['1h'] || data.rain?.['3h'] || 0;
    let description = data.weather?.[0]?.description || 'Clear sky';
    const icon = data.weather?.[0]?.icon || '01d';
    const rawVisibility = data.visibility !== undefined ? data.visibility : 10000;
    const visibilityKm = Math.round(rawVisibility / 1000);

    // Dynamic description override if visibility is low
    if (rawVisibility < 1000 && !description.toLowerCase().includes('fog') && !description.toLowerCase().includes('mist')) {
      description = 'Dense fog';
    }

    const weatherData: WeatherData = {
      station: stationCode,
      rainfall: Math.round(rainfall * 10) / 10,
      description,
      temperature: Math.round(data.main?.temp || 0),
      humidity: data.main?.humidity || 0,
      windSpeed: Math.round((data.wind?.speed || 0) * 3.6),
      visibility: visibilityKm,
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

export async function getCorridorWeather(customApiKey?: string): Promise<Record<string, WeatherData>> {
  const results: Record<string, WeatherData> = {};
  const apiKey = customApiKey || OPENWEATHER_API_KEY;

  for (const stationCode of Object.keys(STATION_COORDS)) {
    // Check cache first
    const cached = getCachedWeather(stationCode);
    if (cached) {
      results[stationCode] = cached;
      continue;
    }

    // Try live API if API Key is available
    if (apiKey) {
      const live = await fetchLiveWeather(stationCode, apiKey);
      if (live) {
        results[stationCode] = live;
        continue;
      }
    }

    // No data available — skip this station
    continue;
  }
  return results;
}

export async function getWeatherAlert(customApiKey?: string): Promise<{
  station: string;
  rainfall: number;
  description: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  source: string;
}> {
  const corridorWeather = await getCorridorWeather(customApiKey);
  const pnbeWeather = corridorWeather.pnbe;
  if (!pnbeWeather) {
    return {
      station: 'pnbe',
      rainfall: 0,
      description: 'No weather data available',
      temperature: 25,
      humidity: 60,
      windSpeed: 5,
      visibility: 10,
      source: 'unavailable'
    };
  }
  return {
    station: pnbeWeather.station,
    rainfall: pnbeWeather.rainfall,
    description: pnbeWeather.description,
    temperature: pnbeWeather.temperature,
    humidity: pnbeWeather.humidity,
    windSpeed: pnbeWeather.windSpeed,
    visibility: pnbeWeather.visibility,
    source: pnbeWeather.source
  };
}
