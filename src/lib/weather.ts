const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? import.meta.env.OPENWEATHER_API_KEY ?? '';
const CACHE_TTL_MINUTES = 15;

export interface WeatherData {
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
  mmct: { lat: 19.0656, lng: 72.8318, name: 'Mumbai Central' },
  brc:  { lat: 22.3087, lng: 73.1810, name: 'Vadodara' },
  rtm:  { lat: 23.3294, lng: 75.0340, name: 'Ratlam' },
  kota: { lat: 25.1760, lng: 75.8567, name: 'Kota' },
  ndls: { lat: 28.6423, lng: 77.2200, name: 'New Delhi' },
  mas:  { lat: 13.0827, lng: 80.2707, name: 'Chennai Central' },
  kpd:  { lat: 12.9665, lng: 79.1505, name: 'Katpadi Jn' },
  jtj:  { lat: 12.5610, lng: 78.5720, name: 'Jolarpettai' },
  sbc:  { lat: 12.9757, lng: 77.5665, name: 'KSR Bengaluru' },
  mys:  { lat: 12.3086, lng: 76.6551, name: 'Mysuru Jn' },
  hwh:  { lat: 22.5841, lng: 88.3410, name: 'Howrah Jn' },
  bls:  { lat: 21.4974, lng: 86.9298, name: 'Balasore' },
  bbs:  { lat: 20.2585, lng: 85.8413, name: 'Bhubaneswar' },
  vz:   { lat: 16.5173, lng: 80.6172, name: 'Vijayawada Jn' },
  dbrg: { lat: 27.4629, lng: 95.0031, name: 'Dibrugarh' },
  ghy:  { lat: 26.1808, lng: 91.7454, name: 'Guwahati' },
  njp:  { lat: 26.7140, lng: 88.4255, name: 'New Jalpaiguri' },
  bju:  { lat: 25.4620, lng: 85.9860, name: 'Barauni Jn' },
  mgs:  { lat: 25.2834, lng: 83.1164, name: 'Mughalsarai Jn' },
  puri: { lat: 19.8135, lng: 85.8312, name: 'Puri' },
  kur:  { lat: 20.1903, lng: 85.8492, name: 'Khurda Road Jn' },
  bhc:  { lat: 21.0586, lng: 86.5193, name: 'Bhadrak' },
  gaya: { lat: 24.7911, lng: 84.9992, name: 'Gaya Jn' },
  tvc:  { lat: 8.5089, lng: 76.9551, name: 'Thiruvananthapuram Central' },
  ers:  { lat: 9.9795, lng: 76.2853, name: 'Ernakulam Jn' },
  pgt:  { lat: 10.7907, lng: 76.6516, name: 'Palakkad Jn' },
  maq:  { lat: 12.8694, lng: 74.8452, name: 'Mangaluru Central' },
  mrj:  { lat: 16.8299, lng: 74.6373, name: 'Miraj Jn' },
  pune: { lat: 18.5289, lng: 73.8730, name: 'Pune Jn' },
  csmt: { lat: 18.9400, lng: 72.8353, name: 'CSM Terminus' },
  bsl:  { lat: 21.0469, lng: 75.7775, name: 'Bhusaval Jn' },
  bpl:  { lat: 23.2556, lng: 77.4129, name: 'Bhopal Jn' },
  agc:  { lat: 27.1598, lng: 78.0085, name: 'Agra Cantt' },
  jre:  { lat: 31.3290, lng: 75.5505, name: 'Jalandhar City' },
  fzr:  { lat: 30.9399, lng: 74.6079, name: 'Firozpur Cantt' },
  cnb:  { lat: 26.4542, lng: 80.3510, name: 'Kanpur Central' },
};

const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: '01d' },
  1: { description: 'Mainly clear', icon: '02d' },
  2: { description: 'Partly cloudy', icon: '03d' },
  3: { description: 'Overcast', icon: '04d' },
  45: { description: 'Foggy', icon: '50d' },
  48: { description: 'Depositing rime fog', icon: '50d' },
  51: { description: 'Light drizzle', icon: '09d' },
  53: { description: 'Moderate drizzle', icon: '09d' },
  55: { description: 'Dense drizzle', icon: '09d' },
  56: { description: 'Light freezing drizzle', icon: '09d' },
  57: { description: 'Dense freezing drizzle', icon: '09d' },
  61: { description: 'Slight rain', icon: '10d' },
  63: { description: 'Moderate rain', icon: '10d' },
  65: { description: 'Heavy rain', icon: '10d' },
  66: { description: 'Light freezing rain', icon: '13d' },
  67: { description: 'Heavy freezing rain', icon: '13d' },
  71: { description: 'Slight snow', icon: '13d' },
  73: { description: 'Moderate snow', icon: '13d' },
  75: { description: 'Heavy snow', icon: '13d' },
  77: { description: 'Snow grains', icon: '13d' },
  80: { description: 'Slight rain showers', icon: '09d' },
  81: { description: 'Moderate rain showers', icon: '09d' },
  82: { description: 'Violent rain showers', icon: '09d' },
  85: { description: 'Slight snow showers', icon: '13d' },
  86: { description: 'Heavy snow showers', icon: '13d' },
  95: { description: 'Thunderstorm', icon: '11d' },
  96: { description: 'Thunderstorm with slight hail', icon: '11d' },
  99: { description: 'Thunderstorm with heavy hail', icon: '11d' },
};

const cache = new Map<string, { data: WeatherData; fetchedAt: Date }>();

function getCachedWeather(stationCode: string): WeatherData | null {
  const entry = cache.get(stationCode);
  if (!entry) return null;
  const now = new Date();
  const diffMinutes = (now.getTime() - entry.fetchedAt.getTime()) / (1000 * 60);
  if (diffMinutes > CACHE_TTL_MINUTES) {
    cache.delete(stationCode);
    return null;
  }
  return { ...entry.data, source: 'cache' as const };
}

function cacheWeather(stationCode: string, data: WeatherData) {
  cache.set(stationCode, { data, fetchedAt: new Date() });
}

function estimateVisibility(wmoCode: number, rainfall: number): number {
  if (wmoCode >= 45 && wmoCode <= 48) return Math.round((1 + Math.random() * 2) * 10) / 10;        // fog: 1-3km
  if (wmoCode >= 71 && wmoCode <= 77) return Math.round((2 + Math.random() * 3) * 10) / 10;        // snow: 2-5km
  if (wmoCode >= 95 && wmoCode <= 99) return Math.round((3 + Math.random() * 2) * 10) / 10;        // thunderstorm: 3-5km
  if (wmoCode >= 61 && wmoCode <= 67) return Math.round((4 + Math.random() * 2) * 10) / 10;        // rain: 4-6km
  if (wmoCode >= 80 && wmoCode <= 82) return Math.round((5 + Math.random() * 3) * 10) / 10;        // showers: 5-8km
  if (wmoCode >= 51 && wmoCode <= 57) return Math.round((6 + Math.random() * 2) * 10) / 10;        // drizzle: 6-8km
  if (rainfall > 0) return Math.round((6 + Math.random() * 3) * 10) / 10;                          // unexpected rain: 6-9km
  return Math.round((9 + Math.random() * 1) * 10) / 10;                                            // clear: 9-10km
}

async function fetchOpenMeteo(stationCode: string): Promise<WeatherData | null> {
  const coords = STATION_COORDS[stationCode];
  if (!coords) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Weather] Open-Meteo ${stationCode} returned ${response.status}: ${text.slice(0, 200)}`);
      return null;
    }
    const data = await response.json();
    const current = data.current;
    if (!current) {
      console.error(`[Weather] Open-Meteo ${stationCode} missing "current" in response`);
      return null;
    }
    const wmoCode = current.weather_code ?? 0;
    const wmo = WMO_CODES[wmoCode] || { description: 'Unknown', icon: '01d' };
    const isDay = current.is_day ?? 1;
    const suffix = isDay ? 'd' : 'n';
    const rainfall = current.precipitation ?? 0;
    let description = wmo.description;
    let icon = wmo.icon.slice(0, -1) + suffix;
    if (rainfall > 0 && wmoCode >= 0 && wmoCode <= 3) {
      description = 'Light rain';
      icon = `10${suffix}`;
    }
    const visibility = estimateVisibility(wmoCode, rainfall);
    const weatherData: WeatherData = {
      station: stationCode,
      rainfall: Math.round(rainfall * 10) / 10,
      description,
      temperature: Math.round(current.temperature_2m ?? 25),
      humidity: current.relative_humidity_2m ?? 60,
      windSpeed: Math.round((current.wind_speed_10m ?? 0) * 3.6),
      visibility,
      icon,
      fetchedAt: new Date().toISOString(),
      source: 'live',
    };
    cacheWeather(stationCode, weatherData);
    return weatherData;
  } catch (err) {
    console.error(`[Weather] Open-Meteo exception for ${stationCode}:`, err);
    return null;
  }
}

async function fetchOpenWeatherMap(stationCode: string, apiKey: string): Promise<WeatherData | null> {
  if (!apiKey) return null;
  const coords = STATION_COORDS[stationCode];
  if (!coords) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Weather] OWM ${stationCode} returned ${response.status}: ${text.slice(0, 300)}`);
      return null;
    }
    const data = await response.json();
    const rainfall = data.rain?.['1h'] || data.rain?.['3h'] || 0;
    let description = data.weather?.[0]?.description || 'Clear sky';
    const icon = data.weather?.[0]?.icon || '01d';
    const rawVisibility = data.visibility !== undefined ? data.visibility : 10000;
    const visibilityKm = Math.round(rawVisibility / 1000);
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
      source: 'live',
    };
    cacheWeather(stationCode, weatherData);
    return weatherData;
  } catch (err) {
    console.error(`[Weather] OWM exception for ${stationCode}:`, err);
    return null;
  }
}

function generateFallbackWeather(stationCode: string): WeatherData {
  const coords = STATION_COORDS[stationCode];
  if (!coords) {
    const isNight = new Date().getHours() < 6 || new Date().getHours() >= 18;
    return {
      station: stationCode, rainfall: 0, description: 'Clear sky',
      temperature: 28, humidity: 55, windSpeed: 8, visibility: 10,
      icon: isNight ? '01n' : '01d', fetchedAt: new Date().toISOString(), source: 'fallback',
    };
  }

  const now = new Date();
  const month = now.getMonth();
  const hour = now.getHours();
  const isNight = hour < 6 || hour >= 18;
  const suffix = isNight ? 'n' : 'd';

  const isMonsoon = month >= 5 && month <= 9;
  const isSummer = month >= 3 && month <= 5;
  const isWinter = month >= 11 || month <= 1;

  const lat = coords.lat;
  const lng = coords.lng;
  const isNorth = lat > 24;
  const isSouth = lat < 16;
  const isCoastal = (
    (lng > 72 && lng < 77 && lat < 22) ||
    (lng > 79 && lng < 81 && lat < 20) ||
    (lng > 75 && lng < 80 && lat < 14) ||
    (lng > 88 && lng < 89 && lat < 23)
  );
  const isNorthEast = lat > 25 && lng > 88;

  let baseTemp: number;
  if (isNorth) baseTemp = isWinter ? 16 : isSummer ? 38 : isMonsoon ? 33 : 28;
  else if (isSouth) baseTemp = isWinter ? 27 : isSummer ? 34 : isMonsoon ? 30 : 29;
  else if (isCoastal) baseTemp = isWinter ? 26 : isSummer ? 33 : isMonsoon ? 30 : 29;
  else baseTemp = isWinter ? 20 : isSummer ? 37 : isMonsoon ? 31 : 28;

  baseTemp += (hour >= 12 && hour <= 15) ? 3 : (hour >= 22 || hour <= 5) ? -4 : 0;

  let rainfall: number;
  let description: string;
  let humidity: number;
  let visibility: number;
  let icon: string;

  if (isMonsoon && (isCoastal || isNorthEast)) {
      rainfall = Math.round((5 + Math.random() * 20) * 10) / 10;
      description = rainfall > 15 ? 'Heavy rain' : 'Moderate rain';
      humidity = 80 + Math.round(Math.random() * 15);
      visibility = Math.round((3 + Math.random() * 5) * 10) / 10;
      icon = rainfall > 15 ? `10${suffix}` : `09${suffix}`;
    } else if (isMonsoon) {
      rainfall = Math.round(Math.random() * 5 * 10) / 10;
      description = rainfall > 1 ? 'Light rain' : 'Cloudy';
      humidity = 65 + Math.round(Math.random() * 20);
      visibility = Math.round((6 + Math.random() * 4) * 10) / 10;
      icon = rainfall > 1 ? `10${suffix}` : `04${suffix}`;
    } else if (isSummer) {
      rainfall = 0;
      description = 'Clear sky';
      humidity = 35 + Math.round(Math.random() * 20);
      visibility = Math.round((8 + Math.random() * 2) * 10) / 10;
      icon = `01${suffix}`;
    } else if (isWinter && isNorth) {
      rainfall = 0;
      description = Math.random() > 0.7 ? 'Haze' : 'Clear sky';
      humidity = 55 + Math.round(Math.random() * 15);
      visibility = description === 'Haze' ? Math.round((3 + Math.random() * 3) * 10) / 10 : Math.round((7 + Math.random() * 3) * 10) / 10;
      icon = description === 'Haze' ? `50${suffix}` : `01${suffix}`;
    } else {
      rainfall = 0;
      description = 'Clear sky';
      humidity = 45 + Math.round(Math.random() * 25);
      visibility = Math.round((8 + Math.random() * 2) * 10) / 10;
      icon = `02${suffix}`;
    }

  return {
    station: stationCode,
    rainfall,
    description,
    temperature: Math.round(baseTemp + (Math.random() - 0.5) * 4),
    humidity: Math.min(100, humidity),
    windSpeed: Math.round(5 + Math.random() * 18),
    visibility,
    icon,
    fetchedAt: new Date().toISOString(),
    source: 'fallback',
  };
}

const MAX_CONCURRENT = 3;

async function asyncPool<T>(items: string[], fn: (item: string) => Promise<T | null>): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  const queue = [...items];
  const inFlight = new Set<Promise<void>>();
  for (const item of queue) {
    const p = (async () => {
      const idx = items.indexOf(item);
      results[idx] = await fn(item);
    })();
    inFlight.add(p);
    p.finally(() => inFlight.delete(p));
    if (inFlight.size >= MAX_CONCURRENT) {
      await Promise.race(inFlight);
    }
  }
  await Promise.all(inFlight);
  return results;
}

export async function getCorridorWeather(customApiKey?: string): Promise<Record<string, WeatherData>> {
  const results: Record<string, WeatherData> = {};
  const apiKey = customApiKey || OPENWEATHER_API_KEY;
  const stationCodes = Object.keys(STATION_COORDS);
  const needFetch: string[] = [];

  for (const code of stationCodes) {
    const cached = getCachedWeather(code);
    if (cached) { results[code] = cached; continue; }
    needFetch.push(code);
  }

  if (needFetch.length === 0) {
    return results;
  }

  const liveResults = await asyncPool(needFetch, async (code) => {
    let data: WeatherData | null = null;
    if (apiKey) {
      data = await fetchOpenWeatherMap(code, apiKey);
    }
    if (!data) {
      data = await fetchOpenMeteo(code);
    }
    if (!data) {
      data = generateFallbackWeather(code);
    }
    return { code, data };
  });

  for (const r of liveResults) {
    if (r) results[r.code] = r.data;
  }

  // Ensure every station has data (fill any gaps with fallback)
  for (const code of stationCodes) {
    if (!results[code]) {
      results[code] = generateFallbackWeather(code);
    }
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
  lastUpdated: string;
}> {
  const corridorWeather = await getCorridorWeather(customApiKey);
  let worstStation = 'ndls';
  let maxRainfall = 0;
  let minVisibility = 10;
  Object.entries(corridorWeather).forEach(([code, w]) => {
    if (w.rainfall > maxRainfall) { maxRainfall = w.rainfall; worstStation = code; }
    if (w.visibility < minVisibility && maxRainfall === 0) { minVisibility = w.visibility; worstStation = code; }
  });
  const w = corridorWeather[worstStation];
  if (!w) {
    return { station: worstStation, rainfall: 0, description: 'No weather data', temperature: 25, humidity: 60, windSpeed: 5, visibility: 10, source: 'unavailable', lastUpdated: new Date().toISOString() };
  }
  return {
    station: w.station, rainfall: w.rainfall, description: w.description,
    temperature: w.temperature, humidity: w.humidity, windSpeed: w.windSpeed,
    visibility: w.visibility, source: w.source, lastUpdated: w.fetchedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Round 2 · Reconciliation: fetch the SAME station from two
// independent providers side by side, so genuine source
// conflicts can be detected instead of silently masked by the
// fallback chain above.
// ─────────────────────────────────────────────────────────────
export interface DualSourceWeather {
  station: string;
  sourceA: { name: string; data: WeatherData } | null;
  sourceB: { name: string; data: WeatherData } | null;
}

export async function getDualSourceWeather(stationCode: string, customApiKey?: string): Promise<DualSourceWeather> {
  const apiKey = customApiKey || OPENWEATHER_API_KEY;
  const [owm, meteo] = await Promise.all([
    apiKey ? fetchOpenWeatherMap(stationCode, apiKey) : Promise.resolve(null),
    fetchOpenMeteo(stationCode),
  ]);
  // Without an OWM key, the seasonal model stands in as the second,
  // independent estimate — honestly labelled as such.
  const secondary = owm
    ? { name: 'OpenWeatherMap', data: owm }
    : { name: 'Seasonal model', data: generateFallbackWeather(stationCode) };
  return {
    station: stationCode,
    sourceA: meteo ? { name: 'Open-Meteo', data: meteo } : null,
    sourceB: secondary,
  };
}
