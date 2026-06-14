import { type Train, STATIONS } from '../data/corridor';

const STATION_CODE_MAP: Record<string, string> = {
  'MMCT': 'mmct', 'BRC': 'brc', 'RTM': 'rtm', 'KOTA': 'kota', 'NDLS': 'ndls',
  'MAS': 'mas', 'KPD': 'kpd', 'JTJ': 'jtj', 'SBC': 'sbc', 'MYS': 'mys',
  'HWH': 'hwh', 'BLS': 'bls', 'BBS': 'bbs', 'VZ': 'vz',
  'DBRG': 'dbrg', 'GHY': 'ghy', 'NJP': 'njp', 'BJU': 'bju', 'MGS': 'mgs',
  'PURI': 'puri', 'KUR': 'kur', 'BHC': 'bhc', 'GAYA': 'gaya',
  'TVC': 'tvc', 'ERS': 'ers', 'PGT': 'pgt', 'MAQ': 'maq', 'MRJ': 'mrj', 'PUNE': 'pune',
  'CSMT': 'csmt', 'BSL': 'bsl', 'BPL': 'bpl', 'AGC': 'agc', 'JRE': 'jre', 'FZR': 'fzr',
  'CNB': 'cnb',
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
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost },
      signal: controller.signal,
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

export function normalizeLiveTrainData(_trainId: string, apiResponse: any, existingTrain: Train): Partial<Train> {
  if (!apiResponse) return {};
  const data = apiResponse.data || apiResponse;
  let delay = 0;
  if (typeof data.delay === 'number') delay = data.delay;
  else if (typeof data.delay === 'string') delay = parseInt(data.delay, 10) || 0;
  else if (data.delay_in_minutes !== undefined) delay = parseInt(data.delay_in_minutes, 10) || 0;

  let speed = existingTrain.speed;
  if (typeof data.current_speed === 'number') speed = data.current_speed;
  else if (typeof data.speed === 'number') speed = data.speed;

  const rawCode = data.current_station_code || (data.current_station && data.current_station.code) || '';
  const mappedCode = rawCode ? STATION_CODE_MAP[rawCode.toUpperCase()] : '';

  let currentStation = existingTrain.currentStation;
  let nextStation = existingTrain.nextStation;
  let progress = existingTrain.routeProgress;

  if (mappedCode) {
    currentStation = mappedCode;
    const routeKeys = Object.keys(STATIONS);
    const currentIdx = routeKeys.indexOf(currentStation);
    if (currentIdx !== -1 && currentIdx < routeKeys.length - 1) {
      nextStation = routeKeys[currentIdx + 1];
    }
  }

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
    routeProgress: Math.min(Math.max(progress, 0), 1),
  };
}

export async function testApiKey(
  apiKey: string,
  apiHost: string = 'irctc1.p.rapidapi.com',
): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await fetchLiveTrainStatus('12951', apiKey, apiHost);
    if (data && typeof data === 'object') {
      return { ok: true, message: 'Connection verified' };
    }
    return { ok: false, message: 'Empty response from API' };
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Network error';
    return { ok: false, message: msg };
  }
}
