import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
}

const kmFromOriginMap: Record<string, number> = {
  NDLS: 0, CNB: 440, ALD: 630, PNBE: 990, HWH: 1531
};

const platformsMap: Record<string, number> = {
  NDLS: 16, CNB: 8, ALD: 7, PNBE: 10, HWH: 15
};

const nameToIdMap: Record<string, string> = {
  'new delhi': 'ndls',
  'kanpur central': 'cnb', 'kanpur': 'cnb',
  'prayagraj junction': 'ald', 'allahabad': 'ald', 'prayagraj': 'ald',
  'patna junction': 'pnbe', 'patna': 'pnbe',
  'howrah junction': 'hwh', 'howrah': 'hwh'
};

export const trainConfig: Record<string, any> = {
  '12301': { type: 'rajdhani', speed: 130, startHour: 16, startMin: 55, capacity: 1000, passengerCount: 920 },
  '12302': { type: 'rajdhani', speed: 130, startHour: 17, startMin: 0, capacity: 1000, passengerCount: 880 },
  '12305': { type: 'rajdhani', speed: 120, startHour: 17, startMin: 15, capacity: 900, passengerCount: 850 },
  '12306': { type: 'rajdhani', speed: 120, startHour: 18, startMin: 0, capacity: 900, passengerCount: 810 },
  '12259': { type: 'duronto', speed: 140, startHour: 8, startMin: 0, capacity: 800, passengerCount: 720 },
  '12381': { type: 'express', speed: 110, startHour: 14, startMin: 30, capacity: 1200, passengerCount: 1150 },
  '12382': { type: 'express', speed: 110, startHour: 15, startMin: 0, capacity: 1200, passengerCount: 1080 }
};

const activeStates: Record<string, any> = {
  '12301': { currentStation: 'pnbe', nextStation: 'hwh', routeProgress: 0.3, coordinates: [86.10, 24.70] },
  '12302': { currentStation: 'ald', nextStation: 'pnbe', routeProgress: 0.5, coordinates: [83.48, 25.52] },
  '12305': { currentStation: 'cnb', nextStation: 'ald', routeProgress: 0.5, coordinates: [81.09, 25.95] },
  '12306': { currentStation: 'ald', nextStation: 'cnb', routeProgress: 0.4, coordinates: [81.40, 25.70] },
  '12259': { currentStation: 'cnb', nextStation: 'pnbe', routeProgress: 0.6, coordinates: [82.65, 26.05] },
  '12381': { currentStation: 'ald', nextStation: 'pnbe', routeProgress: 0.4, coordinates: [83.15, 25.51] },
  '12382': { currentStation: 'pnbe', nextStation: 'ald', routeProgress: 0.5, coordinates: [83.48, 25.52] }
};

function nameToId(name: string): string {
  if (!name) return 'ndls';
  return nameToIdMap[name.toLowerCase()] || 'ndls';
}

export function getEnrichedStations() {
  const stations = readJson<any[]>('station_data.json');
  return stations.map((st: any) => {
    const code = st.code.toUpperCase();
    return {
      id: code.toLowerCase() === 'pryj' ? 'ald' : code.toLowerCase(),
      name: st.name,
      code: code === 'PRYJ' ? 'ALD' : code,
      coordinates: [st.lng, st.lat],
      kmFromOrigin: kmFromOriginMap[code] || 0,
      platforms: platformsMap[code] || 4
    };
  });
}

export function getTrains() {
  const routes = readJson<any[]>('train_routes.json');
  return routes.map((route: any) => {
    const config = trainConfig[route.trainNo] || { type: 'express', capacity: 1000, passengerCount: 900, speed: 90 };
    const active = activeStates[route.trainNo] || {
      currentStation: nameToId(route.route[0]) || 'ndls',
      nextStation: nameToId(route.route[1]) || 'cnb',
      routeProgress: 0.0,
      coordinates: [77.2217, 28.6419]
    };
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
      predictedDelay: 0
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
    Object.fromEntries(
      Object.entries(group).map(([key, vals]) => [
        key,
        Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      ])
    );

  const allDelays = trainRecords.map((r: any) => r.avgDelay);
  const overallAvg = Math.round(allDelays.reduce((a, b) => a + b, 0) / allDelays.length);

  return {
    trainNo,
    recordCount: trainRecords.length,
    avgDelay: overallAvg,
    byWeather: avgOfGroup(byWeather),
    byMonth: avgOfGroup(byMonth)
  };
}

export function predictDelay(
  trainNo: string,
  routeLength: number,
  stationCongestion: string,
  weatherCondition: string,
  rainfall?: number
) {
  const delays = readJson<any[]>('historical_delays.json');
  const stats = getDelayStatsForTrain(trainNo, delays);

  let baseDelay = 15;
  let recordCount = 0;
  let baseSource = 'Global default baseline';

  if (stats) {
    recordCount = stats.recordCount;
    const weatherLower = (weatherCondition || 'Clear').toLowerCase();
    const matchedWeatherKey = Object.keys(stats.byWeather || {}).find(
      key => key.toLowerCase() === weatherLower
    );

    if (matchedWeatherKey && stats.byWeather[matchedWeatherKey] !== undefined) {
      baseDelay = stats.byWeather[matchedWeatherKey];
      baseSource = `Historical avg for ${trainNo} under ${matchedWeatherKey}`;
    } else {
      baseDelay = stats.avgDelay;
      baseSource = `Historical global average for train ${trainNo}`;
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

  const explanation =
    `Prediction Engine Execution Report:\n` +
    `-------------------------------------------\n` +
    `1. Base Delay Score: ${histPoints} pts (Weight: 40% -> ${histWeighted.toFixed(1)} pts)\n` +
    `   * Source: ${baseSource} (${baseDelay} min average)\n` +
    `2. Weather Hazard Score: ${weatherPoints} pts (Weight: 25% -> ${weatherWeighted.toFixed(1)} pts)\n` +
    `   * Condition: "${weatherCondition}"\n` +
    `3. Node Congestion Score: ${congestionPoints} pts (Weight: 20% -> ${congestionWeighted.toFixed(1)} pts)\n` +
    `   * Active Risk Level: "${congLower.toUpperCase()}"\n` +
    `4. Route Propagation Score: ${routePoints} pts (Weight: 15% -> ${routeWeighted.toFixed(1)} pts)\n` +
    `   * Distance: ${routeLength} km\n` +
    `-------------------------------------------\n` +
    `* Weighted Score Sum: ${weightedScore.toFixed(1)} / 100.0 pts\n` +
    `* Delay Estimate Formula: Math.round(${weightedScore.toFixed(1)}% of 120 mins) = ${predictedDelay} mins\n` +
    `* Confidence Level: ${Math.round(confidence * 100)}%\n` +
    `  - Deductions: Historical Logs (-${Math.round(histPenalty * 100)}%), Weather Hazard (-${Math.round(weatherPenalty * 100)}%), Congestion Volatility (-${Math.round(congestionPenalty * 100)}%), Route Distance Variance (-${Math.round(distancePenalty * 100)}%)`;

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
    const code = stationId.toUpperCase() === 'ALD' ? 'PRYJ' : stationId.toUpperCase();

    const nextKm = kmFromOriginMap[code] || currentKm;
    const distance = nextKm - currentKm;

    if (i > 0 && distance > 0) {
      const travelHours = distance / config.speed;
      const travelMinutes = Math.round(travelHours * 60);
      currentTime.setMinutes(currentTime.getMinutes() + travelMinutes);
    }

    const scheduledArrival = i === 0 ? '' : currentTime.toTimeString().substring(0, 5);

    if (i > 0 && i < routeStations.length - 1) {
      currentTime.setMinutes(currentTime.getMinutes() + 10);
    }

    const scheduledDeparture = i === routeStations.length - 1 ? '' : currentTime.toTimeString().substring(0, 5);

    stops.push({
      stationCode: code === 'PRYJ' ? 'ALD' : code,
      km: nextKm,
      scheduledArrival: scheduledArrival || scheduledDeparture,
      scheduledDeparture: scheduledDeparture || scheduledArrival
    });

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
    const pred = predictDelay(
      trainId,
      stop.km,
      query.congestion || 'low',
      query.weather || 'Clear',
      query.rainfall ? Number(query.rainfall) : undefined
    );

    return {
      stationCode: stop.stationCode,
      scheduledArrival: stop.scheduledArrival,
      scheduledDeparture: stop.scheduledDeparture,
      actualArrival: addMinutesToTime(stop.scheduledArrival, pred.predictedDelay),
      actualDeparture: addMinutesToTime(stop.scheduledDeparture, pred.predictedDelay),
      km: stop.km,
      prediction: {
        predictedDelay: pred.predictedDelay,
        confidence: pred.confidence,
        explanation: pred.explanation
      }
    };
  });

  return { trainId: route.trainNo, stops: mergedStops };
}

export function runCascadeSimulation(stationId: string, scenario: string) {
  const stations = getEnrichedStations();
  const routes = readJson<any[]>('train_routes.json');
  const delays = readJson<any[]>('historical_delays.json');

  const sortedStations = [...stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);
  const triggerIndex = sortedStations.findIndex(s => s.id === stationId);

  if (triggerIndex === -1) return null;

  const downstreamStationIds = sortedStations.slice(triggerIndex).map(s => s.id);

  const affectedTrains = routes.filter((route: any) => {
    const active = activeStates[route.trainNo] || { currentStation: '', nextStation: '' };
    return downstreamStationIds.includes(active.currentStation) || downstreamStationIds.includes(active.nextStation);
  });

  const scenarioWeatherMap: Record<string, string> = { rainfall: 'Rain', fog: 'Fog' };
  const targetWeather = scenarioWeatherMap[scenario] || 'Rain';

  const matchingHistoricalDelay = delays.find(
    (d: any) => d.weather.toLowerCase() === targetWeather.toLowerCase()
  );

  let delayMultiplier = 20;
  let conflictWeight = 1.5;

  if (matchingHistoricalDelay) {
    delayMultiplier = matchingHistoricalDelay.avgDelay;
    conflictWeight = matchingHistoricalDelay.avgDelay > 30 ? 3.0 :
                     matchingHistoricalDelay.avgDelay > 15 ? 1.8 : 1.2;
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

  const stationsImpacted = sortedStations
    .slice(triggerIndex, triggerIndex + Math.min(3, sortedStations.length - triggerIndex))
    .map(s => s.id);

  return { conflictsDetected, cascadeDelay, passengersAffected, stationsImpacted };
}
