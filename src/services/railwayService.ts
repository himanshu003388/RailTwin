import { type Train, SORTED_STATIONS } from '../data/corridor';

// Map official IR station codes to our local station IDs
const STATION_CODE_MAP: Record<string, string> = {
  'NDLS': 'ndls',
  'CNB': 'cnb',
  'ALD': 'ald',
  'PRYJ': 'ald', // Prayagraj Junction
  'PNBE': 'pnbe',
  'HWH': 'hwh'
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function fetchLiveTrainStatus(
  trainId: string,
  apiKey: string,
  apiHost: string = 'irctc1.p.rapidapi.com'
): Promise<any> {
  const url = `https://${apiHost}/api/v1/liveTrainStatus?trainNo=${trainId}&startDay=0`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const msg = body?.message || body?.error || body?.detail || `HTTP ${response.status}`;
      throw new ApiError(msg, response.status);
    }

    return body;
  } catch (e: unknown) {
    clearTimeout(timeout);
    if (e instanceof ApiError) throw e;
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.name === 'AbortError') throw new ApiError('Request timed out', 408);
    throw new ApiError(err.message || 'Network error', 0);
  }
}

export async function testApiKey(
  apiKey: string,
  apiHost: string = 'irctc1.p.rapidapi.com'
): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await fetchLiveTrainStatus('12301', apiKey, apiHost);
    if (data && typeof data === 'object') {
      return { ok: true, message: 'Connection verified' };
    }
    return { ok: false, message: 'Empty response from API' };
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Network error';
    return { ok: false, message: msg };
  }
}

export function normalizeLiveTrainData(_trainId: string, apiResponse: any, existingTrain: Train): Partial<Train> {
  if (!apiResponse) return {};

  const data = apiResponse.data || apiResponse;

  // Extract delay (in minutes)
  let delay = 0;
  if (typeof data.delay === 'number') {
    delay = data.delay;
  } else if (typeof data.delay === 'string') {
    delay = parseInt(data.delay, 10) || 0;
  } else if (data.current_station && typeof data.current_station.delay === 'number') {
    delay = data.current_station.delay;
  } else if (data.delay_in_minutes !== undefined) {
    delay = parseInt(data.delay_in_minutes, 10) || 0;
  }

  // Extract speed
  let speed = existingTrain.speed;
  if (typeof data.current_speed === 'number') {
    speed = data.current_speed;
  } else if (typeof data.speed === 'number') {
    speed = data.speed;
  } else if (data.current_station && typeof data.current_station.speed === 'number') {
    speed = data.current_station.speed;
  }

  // Extract station code
  const rawCode = data.current_station_code || 
                  (data.current_station && data.current_station.code) || 
                  data.station_code || 
                  '';
  const mappedCode = rawCode ? STATION_CODE_MAP[rawCode.toUpperCase()] : '';

  // Calculate current and next station along the corridor
  let currentStation = existingTrain.currentStation;
  let nextStation = existingTrain.nextStation;
  let progress = existingTrain.routeProgress;

  if (mappedCode) {
    currentStation = mappedCode;
    const currentIndex = SORTED_STATIONS.findIndex(s => s.id === currentStation);
    if (currentIndex !== -1 && currentIndex < SORTED_STATIONS.length - 1) {
      nextStation = SORTED_STATIONS[currentIndex + 1].id;
    }
  }

  // Handle upcoming stations to refine nextStation if available
  const upcomingRaw = data.upcoming_stations || data.route || [];
  if (Array.isArray(upcomingRaw) && upcomingRaw.length > 0) {
    const nextCorridorStation = upcomingRaw.find(st => {
      const code = st.station_code || st.code || '';
      return code && STATION_CODE_MAP[code.toUpperCase()];
    });

    if (nextCorridorStation) {
      const code = nextCorridorStation.station_code || nextCorridorStation.code;
      const target = STATION_CODE_MAP[code.toUpperCase()];
      if (target !== currentStation) {
        nextStation = target;
      }
    }
  }

  // Estimate progress based on distance covered if available
  if (data.distance_covered !== undefined && data.distance_to_go !== undefined) {
    const total = data.distance_covered + data.distance_to_go;
    progress = total > 0 ? data.distance_covered / total : progress;
  } else if (data.route_progress !== undefined) {
    progress = parseFloat(data.route_progress) || progress;
  }

  return {
    currentStation,
    nextStation,
    predictedDelay: delay,
    scheduledDelay: delay,
    speed: speed > 0 ? speed : 80,
    routeProgress: Math.min(Math.max(progress, 0), 1)
  };
}
