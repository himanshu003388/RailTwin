import fs from 'fs';
import path from 'path';
import { matchStation } from './reconciler';
import { logAudit } from './db';

const dataDir = path.resolve(process.cwd(), 'data');

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
}

const kmFromOriginMap: Record<string, number> = {
  NDLS: 0, CNB: 440, MGS: 555, GAYA: 465, HWH: 0,
  MMCT: 0, BRC: 392, RTM: 648, KOTA: 924,
  MAS: 0, KPD: 130, JTJ: 214, SBC: 0, MYS: 140,
  BLS: 235, BBS: 435, VZ: 886, PURI: 0, KUR: 82, BHC: 198,
  DBRG: 0, GHY: 500, NJP: 830, BJU: 1118,
  TVC: 0, ERS: 220, PGT: 320, MAQ: 622, MRJ: 1100, PUNE: 1430,
  CSMT: 0, BSL: 501, BPL: 773, AGC: 1201, JRE: 1732, FZR: 1795,
};

const platformsMap: Record<string, number> = {
  NDLS: 16, CNB: 8, MGS: 8, GAYA: 7, HWH: 15,
  MMCT: 8, BRC: 8, RTM: 6, KOTA: 6,
  MAS: 12, KPD: 6, JTJ: 4, SBC: 10, MYS: 8,
  BLS: 5, BBS: 7, VZ: 10, PURI: 6, KUR: 5, BHC: 4,
  DBRG: 5, GHY: 8, NJP: 7, BJU: 6,
  TVC: 8, ERS: 8, PGT: 6, MAQ: 6, MRJ: 6, PUNE: 8,
  CSMT: 18, BSL: 7, BPL: 8, AGC: 8, JRE: 5, FZR: 4,
};

const nameToIdMap: Record<string, string> = {
  'mumbai central': 'mmct', 'vadodara': 'brc', 'ratlam': 'rtm', 'kota': 'kota',
  'new delhi': 'ndls', 'chennai central': 'mas', 'katpadi jn': 'kpd', 'jolarpettai': 'jtj',
  'ksr bengaluru': 'sbc', 'bengaluru': 'sbc', 'mysuru jn': 'mys', 'mysore': 'mys',
  'howrah jn': 'hwh', 'howrah': 'hwh', 'balasore': 'bls', 'bhubaneswar': 'bbs',
  'vijayawada jn': 'vz', 'dibrugarh': 'dbrg', 'guwahati': 'ghy',
  'new jalpaiguri': 'njp', 'barauni jn': 'bju', 'mughalsarai jn': 'mgs',
  'puri': 'puri', 'khurda road jn': 'kur', 'bhadrak': 'bhc', 'gaya jn': 'gaya',
  'thiruvananthapuram central': 'tvc', 'ernakulam jn': 'ers', 'palakkad jn': 'pgt',
  'mangaluru central': 'maq', 'miraj jn': 'mrj', 'pune jn': 'pune',
  'chhatrapati shivaji maharaj terminus': 'csmt', 'bhusaval jn': 'bsl',
  'bhopal jn': 'bpl', 'agra cantt': 'agc', 'jalandhar city': 'jre', 'firozpur cantt': 'fzr',
  'kanpur central': 'cnb', 'kanpur': 'cnb',
};

const trainConfig: Record<string, any> = {
  '12951': { type: 'rajdhani', speed: 130, startHour: 16, startMin: 35, capacity: 1000, passengerCount: 920, zone: 'WR' },
  '12007': { type: 'shatabdi', speed: 110, startHour: 6, startMin: 0, capacity: 750, passengerCount: 680, zone: 'SR' },
  '12423': { type: 'rajdhani', speed: 110, startHour: 13, startMin: 0, capacity: 850, passengerCount: 780, zone: 'NFR' },
  '12801': { type: 'express', speed: 100, startHour: 8, startMin: 0, capacity: 1400, passengerCount: 1300, zone: 'ECR' },
  '12625': { type: 'express', speed: 90, startHour: 16, startMin: 45, capacity: 1500, passengerCount: 1400, zone: 'SR' },
  '12137': { type: 'mail', speed: 85, startHour: 20, startMin: 0, capacity: 1600, passengerCount: 1480, zone: 'CR' },
  '12301': { type: 'rajdhani', speed: 130, startHour: 16, startMin: 55, capacity: 1000, passengerCount: 920, zone: 'ER' },
};

const activeStates: Record<string, any> = {
  '12951': { currentStation: 'brc', nextStation: 'rtm', routeProgress: 0.3, coordinates: [74.20, 22.85] },
  '12007': { currentStation: 'kpd', nextStation: 'jtj', routeProgress: 0.5, coordinates: [78.85, 12.75] },
  '12423': { currentStation: 'njp', nextStation: 'bju', routeProgress: 0.5, coordinates: [87.20, 26.10] },
  '12801': { currentStation: 'bbs', nextStation: 'kur', routeProgress: 0.3, coordinates: [85.85, 20.25] },
  '12625': { currentStation: 'ers', nextStation: 'pgt', routeProgress: 0.6, coordinates: [76.45, 10.45] },
  '12137': { currentStation: 'bpl', nextStation: 'agc', routeProgress: 0.5, coordinates: [77.80, 25.20] },
  '12301': { currentStation: 'gaya', nextStation: 'mgs', routeProgress: 0.4, coordinates: [84.05, 25.04] },
};

// Round 2 · Reconciliation: Round 1 silently mapped ANY unknown station
// name to 'ndls' here. Now unknown names go through the Jaro-Winkler
// matcher: confident matches are accepted, ambiguous ones are flagged in
// the audit log as needs-review before the explicit fallback is applied.
const nameMatchCache: Record<string, string> = {};
const flaggedUnknownNames = new Set<string>();

function nameToId(name: string): string {
  if (!name) return 'ndls';
  const key = name.toLowerCase();
  const direct = nameToIdMap[key];
  if (direct) return direct;
  const cached = nameMatchCache[key];
  if (cached) return cached;

  const match = matchStation(name);
  if ((match.status === 'exact' || match.status === 'auto') && match.matchedId) {
    nameMatchCache[key] = match.matchedId;
    return match.matchedId;
  }
  // Partially matching / unknown record: flag once for operator review
  // instead of swallowing it silently, then fall back explicitly.
  if (!flaggedUnknownNames.has(key)) {
    flaggedUnknownNames.add(key);
    logAudit('station_name_needs_review', {
      input: name,
      similarity: match.similarity,
      candidates: match.candidates,
      appliedFallback: 'ndls',
    });
  }
  nameMatchCache[key] = 'ndls';
  return 'ndls';
}

export function getEnrichedStations() {
  const stations = readJson<any[]>('station_data.json');
  return stations.map((st: any) => {
    const code = st.code.toUpperCase();
    return {
      id: code.toLowerCase(),
      name: st.name,
      code,
      coordinates: [st.lng, st.lat],
      kmFromOrigin: kmFromOriginMap[code] || 0,
      platforms: platformsMap[code] || 4,
      zone: st.zone || '',
    };
  });
}

export function getTrains() {
  const routes = readJson<any[]>('train_routes.json');
  return routes.map((route: any) => {
    const config = trainConfig[route.trainNo] || { type: 'express', capacity: 1000, passengerCount: 900, speed: 90, zone: '' };
    const active = activeStates[route.trainNo] || { currentStation: nameToId(route.route[0]), nextStation: nameToId(route.route[1]), routeProgress: 0.0, coordinates: [77.22, 28.64] };
    return {
      id: route.trainNo,
      name: route.trainName,
      type: config.type,
      capacity: config.capacity,
      passengerCount: config.passengerCount,
      speed: config.speed,
      currentStation: active.currentStation,
      nextStation: active.nextStation,
      routeProgress: active.routeProgress,
      coordinates: active.coordinates,
      predictedDelay: 0,
      zone: config.zone || '',
    };
  });
}

function getDelayStatsForTrain(trainNo: string, records: any[]) {
  const trainRecords = records.filter((d: any) => d.trainNo === trainNo);
  if (trainRecords.length === 0) return null;
  const byWeather: Record<string, number[]> = {};
  const byMonth: Record<string, number[]> = {};
  for (const r of trainRecords) {
    if (!byWeather[r.weather]) byWeather[r.weather] = [];
    byWeather[r.weather].push(r.avgDelay);
    if (!byMonth[r.month]) byMonth[r.month] = [];
    byMonth[r.month].push(r.avgDelay);
  }
  const avgOfGroup = (group: Record<string, number[]>) =>
    Object.fromEntries(Object.entries(group).map(([key, vals]) => [key, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)]));
  const allDelays = trainRecords.map((r: any) => r.avgDelay);
  const overallAvg = Math.round(allDelays.reduce((a, b) => a + b, 0) / allDelays.length);
  return { trainNo, recordCount: trainRecords.length, avgDelay: overallAvg, byWeather: avgOfGroup(byWeather), byMonth: avgOfGroup(byMonth) };
}

export function predictDelay(trainNo: string, routeLength: number, stationCongestion: string, weatherCondition: string, rainfall?: number) {
  const delays = readJson<any[]>('historical_delays.json');
  const stats = getDelayStatsForTrain(trainNo, delays);
  let baseDelay = 15;
  let recordCount = 0;
  if (stats) {
    recordCount = stats.recordCount;
    const weatherLower = (weatherCondition || 'Clear').toLowerCase();
    const matchedWeatherKey = Object.keys(stats.byWeather || {}).find(key => key.toLowerCase() === weatherLower);
    if (matchedWeatherKey && stats.byWeather[matchedWeatherKey] !== undefined) {
      baseDelay = stats.byWeather[matchedWeatherKey];
    } else {
      baseDelay = stats.avgDelay;
    }
  }
  const histPoints = Math.min(100, Math.round((baseDelay / 60) * 100));
  const histWeighted = histPoints * 0.40;
  let weatherPoints = 0;
  const weatherLower = (weatherCondition || 'Clear').toLowerCase();
  if (weatherLower.includes('fog')) weatherPoints = 100;
  else if (weatherLower.includes('heavy') || (rainfall && rainfall > 50)) weatherPoints = 75;
  else if (weatherLower.includes('rain') || weatherLower.includes('monsoon')) weatherPoints = 40;
  else if (weatherLower.includes('clear') || weatherLower.includes('good')) weatherPoints = 0;
  else weatherPoints = 20;
  const weatherWeighted = weatherPoints * 0.25;
  let congestionPoints = 0;
  const congLower = (stationCongestion || 'low').toLowerCase();
  if (congLower === 'low') congestionPoints = 0;
  else if (congLower === 'moderate') congestionPoints = 30;
  else if (congLower === 'high') congestionPoints = 70;
  else if (congLower === 'critical') congestionPoints = 100;
  else congestionPoints = 20;
  const congestionWeighted = congestionPoints * 0.20;
  const routePoints = Math.min(100, Math.round((routeLength / 1500) * 100));
  const routeWeighted = routePoints * 0.15;
  const weightedScore = histWeighted + weatherWeighted + congestionWeighted + routeWeighted;
  const predictedDelay = Math.round((weightedScore / 100) * 120);
  let histPenalty = 0.25;
  if (recordCount >= 10) histPenalty = 0.0;
  else if (recordCount >= 5) histPenalty = 0.05;
  else if (recordCount >= 1) histPenalty = 0.10;
  let weatherPenalty = 0.0;
  if (weatherLower.includes('fog')) weatherPenalty = 0.20;
  else if (weatherLower.includes('heavy')) weatherPenalty = 0.15;
  else if (weatherLower.includes('rain')) weatherPenalty = 0.08;
  let congestionPenalty = 0.0;
  if (congLower === 'critical') congestionPenalty = 0.18;
  else if (congLower === 'high') congestionPenalty = 0.12;
  else if (congLower === 'moderate') congestionPenalty = 0.05;
  const distancePenalty = Math.min(0.15, (routeLength / 5000) * 0.15);
  const totalPenalties = histPenalty + weatherPenalty + congestionPenalty + distancePenalty;
  const confidence = Math.max(0.10, Math.round((1.0 - totalPenalties) * 100) / 100);
  const explanation = `Prediction Engine Report:\n1. Base: ${histPoints}pts (40%) → ${histWeighted.toFixed(1)}\n2. Weather: ${weatherPoints}pts (25%) → ${weatherWeighted.toFixed(1)}\n3. Congestion: ${congestionPoints}pts (20%) → ${congestionWeighted.toFixed(1)}\n4. Route: ${routePoints}pts (15%) → ${routeWeighted.toFixed(1)}\nTotal: ${weightedScore.toFixed(1)} → ~${predictedDelay}min delay\nConfidence: ${Math.round(confidence * 100)}%`;
  return { predictedDelay, confidence, explanation };
}

function getSyntheticStopsForRoute(trainNo: string, routeStations: string[]) {
  const config = trainConfig[trainNo] || { type: 'express', speed: 80, startHour: 12, startMin: 0 };
  let currentKm = 0;
  let currentTime = new Date();
  currentTime.setHours(config.startHour, config.startMin, 0, 0);
  const stops: any[] = [];
  for (let i = 0; i < routeStations.length; i++) {
    const stationName = routeStations[i];
    const stationId = nameToId(stationName);
    const code = stationId.toUpperCase();
    const nextKm = kmFromOriginMap[code] || currentKm;
    const distance = nextKm - currentKm;
    if (i > 0 && distance > 0) {
      const travelHours = distance / config.speed;
      currentTime.setMinutes(currentTime.getMinutes() + Math.round(travelHours * 60));
    }
    const scheduledArrival = i === 0 ? '' : currentTime.toTimeString().substring(0, 5);
    if (i > 0 && i < routeStations.length - 1) {
      currentTime.setMinutes(currentTime.getMinutes() + 10);
    }
    const scheduledDeparture = i === routeStations.length - 1 ? '' : currentTime.toTimeString().substring(0, 5);
    stops.push({ stationCode: code, km: nextKm, scheduledArrival: scheduledArrival || scheduledDeparture, scheduledDeparture: scheduledDeparture || scheduledArrival });
    currentKm = nextKm;
  }
  return stops;
}

export function getTrainSchedule(trainId: string, query: Record<string, string>) {
  const routes = readJson<any[]>('train_routes.json');
  const route = routes.find((r: any) => r.trainNo === trainId);
  if (!route) return null;
  const stops = getSyntheticStopsForRoute(route.trainNo, route.route);
  const addMinutesToTime = (timeStr: string, mins: number) => {
    if (!timeStr || !mins) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + mins, 0, 0);
    return date.toTimeString().substring(0, 5);
  };
  const mergedStops = stops.map(stop => {
    const pred = predictDelay(trainId, stop.km, query.congestion || 'low', query.weather || 'Clear', query.rainfall ? Number(query.rainfall) : undefined);
    return {
      stationCode: stop.stationCode,
      scheduledArrival: stop.scheduledArrival,
      scheduledDeparture: stop.scheduledDeparture,
      actualArrival: addMinutesToTime(stop.scheduledArrival, pred.predictedDelay),
      actualDeparture: addMinutesToTime(stop.scheduledDeparture, pred.predictedDelay),
      km: stop.km,
      prediction: { predictedDelay: pred.predictedDelay, confidence: pred.confidence, explanation: pred.explanation },
    };
  });
  return { trainId: route.trainNo, stops: mergedStops };
}

export function runCascadeSimulation(stationId: string, scenario: string) {
  const stations = getEnrichedStations();
  const routes = readJson<any[]>('train_routes.json');
  const delays = readJson<any[]>('historical_delays.json');
  const station = stations.find((s: any) => s.id === stationId);
  if (!station) return null;
  const affectedTrains = routes.filter((route: any) => {
    const active: any = activeStates[route.trainNo] || {};
    return active.currentStation === stationId || active.nextStation === stationId;
  });
  const scenarioWeatherMap: Record<string, string> = { rainfall: 'Rain', fog: 'Fog', signal_failure: 'Rain', track_damage: 'Monsoon' };
  const targetWeather = scenarioWeatherMap[scenario] || 'Rain';
  const matchingHistoricalDelay = delays.find((d: any) => d.weather.toLowerCase() === targetWeather.toLowerCase());
  let delayMultiplier = 20;
  let conflictWeight = 1.5;
  if (matchingHistoricalDelay) {
    delayMultiplier = matchingHistoricalDelay.avgDelay;
    conflictWeight = matchingHistoricalDelay.avgDelay > 30 ? 3.0 : matchingHistoricalDelay.avgDelay > 15 ? 1.8 : 1.2;
  } else {
    if (scenario === 'rainfall') { delayMultiplier = 35; conflictWeight = 2.0; }
    else if (scenario === 'signal_failure') { delayMultiplier = 50; conflictWeight = 2.5; }
    else if (scenario === 'track_damage') { delayMultiplier = 80; conflictWeight = 4.0; }
    else if (scenario === 'fog') { delayMultiplier = 25; conflictWeight = 1.2; }
  }
  const affectedCount = affectedTrains.length;
  const totalTrains = routes.length;
  const cascadeDelay = Math.round(delayMultiplier * (0.6 + (affectedCount / totalTrains) * 0.8));
  const conflictsDetected = Math.max(1, Math.round(conflictWeight * (affectedCount / totalTrains) * 3));
  const passengersAffected = affectedTrains.reduce((sum: number, t: any) => {
    const config = trainConfig[t.trainNo] || { passengerCount: 800 };
    return sum + config.passengerCount;
  }, 0);
  const stationsImpacted = [stationId];
  if (affectedTrains.length > 0) {
    const nextStations = affectedTrains.map((t: any) => activeStates[t.trainNo]?.nextStation).filter(Boolean);
    const uniqueNext = [...new Set(nextStations)].slice(0, 2);
    stationsImpacted.push(...uniqueNext);
  }
  return { conflictsDetected, cascadeDelay, passengersAffected, stationsImpacted };
}
