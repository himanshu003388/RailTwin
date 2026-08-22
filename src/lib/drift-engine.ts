// ─────────────────────────────────────────────────────────────
// Drift Engine — Round 2 "Reconciliation: Drift Indicator"
//
// Pure module: no fs, no db, no fetch. Runs identically in the
// browser (live dashboard) and in Node (tests), the same way the
// Ridge model does. computeDrift(baseline, live) diffs the
// originally recorded context against the current situation and
// returns an explainable 0-100 drift score per train.
//
// Score = 0.40·schedule + 0.25·position + 0.20·prediction + 0.15·weather
// The weights deliberately mirror the Tier-2 prediction weights
// (40/25/20/15) already documented in the README, so the whole
// system shares one weighting philosophy. No LLM involvement:
// Gemini may *explain* a drift score, it never produces one.
// ─────────────────────────────────────────────────────────────

import { STATIONS, TRAIN_ROUTES, haversineKm } from '../data/corridor';
import type {
  BaselineSnapshot,
  BaselineTrainSnapshot,
  DriftClass,
  DriftComponent,
  DriftReport,
  LiveSnapshot,
  TrainDrift,
  WeatherSnapshot,
} from '../data/types';

export const DRIFT_WEIGHTS = {
  schedule: 0.4,
  position: 0.25,
  prediction: 0.2,
  weather: 0.15,
} as const;

// Normalisation ceilings: the raw value that maps to 100 points.
export const DRIFT_CEILINGS = {
  scheduleMinutes: 45, // 45 min of delay movement = fully drifted
  positionKm: 120,     // 120 km from the expected position = fully drifted
} as const;

export const DRIFT_THRESHOLDS: Array<{ max: number; cls: DriftClass }> = [
  { max: 15, cls: 'stable' },
  { max: 40, cls: 'minor' },
  { max: 70, cls: 'significant' },
  { max: 101, cls: 'critical' },
];

export function classifyDrift(score: number): DriftClass {
  for (const t of DRIFT_THRESHOLDS) if (score < t.max) return t.cls;
  return 'critical';
}

/** Collapse a weather snapshot into the same classes the prediction engine uses. */
export function weatherClassOf(w: WeatherSnapshot | undefined): string {
  if (!w) return 'Unknown';
  if (w.visibility < 1) return 'Fog';
  if (w.rainfall > 50) return 'Heavy Rain';
  if (w.rainfall > 0) return 'Rain';
  const desc = (w.description || '').toLowerCase();
  if (desc.includes('fog') || desc.includes('mist')) return 'Fog';
  if (desc.includes('thunder')) return 'Heavy Rain';
  if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower')) return 'Rain';
  return 'Clear';
}

interface RouteGeometry {
  ids: string[];
  cumKm: number[]; // cumulative km at each station index
  totalKm: number;
}

const geometryCache = new Map<string, RouteGeometry>();

function routeGeometry(trainId: string): RouteGeometry | null {
  const cached = geometryCache.get(trainId);
  if (cached) return cached;
  const ids = TRAIN_ROUTES[trainId];
  if (!ids || ids.length < 2) return null;
  const cumKm: number[] = [0];
  for (let i = 1; i < ids.length; i++) {
    const a = STATIONS[ids[i - 1]];
    const b = STATIONS[ids[i]];
    const d = a && b ? haversineKm(a.coordinates, b.coordinates) : 100;
    cumKm.push(cumKm[i - 1] + d);
  }
  const geo = { ids, cumKm, totalKm: cumKm[cumKm.length - 1] };
  geometryCache.set(trainId, geo);
  return geo;
}

/** Distance travelled along the route implied by (currentStation, routeProgress). */
export function kmAlongRoute(trainId: string, currentStation: string, progress: number): number {
  const geo = routeGeometry(trainId);
  if (!geo) return 0;
  const idx = geo.ids.indexOf(currentStation);
  if (idx < 0) return 0;
  if (idx >= geo.ids.length - 1) return geo.totalKm;
  const segLen = geo.cumKm[idx + 1] - geo.cumKm[idx];
  return geo.cumKm[idx] + Math.min(Math.max(progress, 0), 1) * segLen;
}

/** Coordinates at a given km along a train's route. */
export function coordsAtKm(trainId: string, km: number): [number, number] {
  const geo = routeGeometry(trainId);
  if (!geo) return [78, 22];
  const clamped = Math.min(Math.max(km, 0), geo.totalKm);
  for (let i = 1; i < geo.ids.length; i++) {
    if (clamped <= geo.cumKm[i]) {
      const a = STATIONS[geo.ids[i - 1]];
      const b = STATIONS[geo.ids[i]];
      const segLen = geo.cumKm[i] - geo.cumKm[i - 1];
      const t = segLen > 0 ? (clamped - geo.cumKm[i - 1]) / segLen : 0;
      return [
        a.coordinates[0] + (b.coordinates[0] - a.coordinates[0]) * t,
        a.coordinates[1] + (b.coordinates[1] - a.coordinates[1]) * t,
      ];
    }
  }
  const last = STATIONS[geo.ids[geo.ids.length - 1]];
  return last ? last.coordinates : [78, 22];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function componentScore(
  key: DriftComponent['key'],
  label: string,
  raw: number,
  unit: string,
  normalized: number,
  detail: string,
): DriftComponent {
  const weight = DRIFT_WEIGHTS[key];
  const norm = Math.min(100, Math.max(0, round1(normalized)));
  return { key, label, raw: round1(raw), unit, normalized: norm, weight, weighted: round1(norm * weight), detail };
}

function driftForTrain(
  base: BaselineTrainSnapshot,
  live: BaselineTrainSnapshot,
  baseline: BaselineSnapshot,
  liveSnap: LiveSnapshot,
  elapsedMinutes: number,
): TrainDrift {
  // ── 1 · Schedule drift (40%): how far the delay picture moved ──
  const deltaMin = Math.abs(live.predictedDelay - base.predictedDelay);
  const schedule = componentScore(
    'schedule', 'Schedule drift', deltaMin, 'min',
    (deltaMin / DRIFT_CEILINGS.scheduleMinutes) * 100,
    `Recorded delay ${base.predictedDelay}min → now ${live.predictedDelay}min (Δ${deltaMin}min)`,
  );

  // ── 2 · Position drift (25%): live position vs where the recorded
  //        context said the train would be by now ──
  const baseKm = kmAlongRoute(base.trainId, base.currentStation, base.routeProgress);
  const liveKm = kmAlongRoute(live.trainId, live.currentStation, live.routeProgress);
  const geo = routeGeometry(base.trainId);
  const totalKm = geo ? geo.totalKm : 1500;
  const expectedKm = Math.min(totalKm, baseKm + base.speed * (elapsedMinutes / 60));
  const posDriftKm = Math.abs(liveKm - expectedKm);
  const position = componentScore(
    'position', 'Position drift', posDriftKm, 'km',
    (posDriftKm / DRIFT_CEILINGS.positionKm) * 100,
    `Plan implied km ${Math.round(expectedKm)} of ${Math.round(totalKm)}; live at km ${Math.round(liveKm)} (Δ${Math.round(posDriftKm)}km)`,
  );

  // ── 3 · Prediction drift (20%): do the assumptions the recorded
  //        prediction was made under still hold? (model self-audit) ──
  const baseCond = base.weatherConditionAtNext || 'Clear';
  const liveCond = live.weatherConditionAtNext || 'Clear';
  const condChanged = baseCond !== liveCond;
  const confDelta = Math.abs((live.confidence ?? 0.65) - (base.confidence ?? 0.65));
  const predNorm = (condChanged ? 60 : 0) + Math.min(40, confDelta * 100);
  const prediction = componentScore(
    'prediction', 'Prediction drift', predNorm, 'pts', predNorm,
    condChanged
      ? `Prediction assumed "${baseCond}" at ${live.nextStation.toUpperCase()}; conditions are now "${liveCond}" — recorded forecast no longer valid`
      : `Prediction assumptions still hold ("${baseCond}"); confidence moved ${round1(confDelta * 100)}pts`,
  );

  // ── 4 · Weather drift (15%): observed weather vs the recorded
  //        forecast at the stations this train touches next ──
  let weatherNorm = 0;
  let weatherDetail = 'Observed weather matches the recorded context';
  let rainDelta = 0;
  for (const stationId of [live.currentStation, live.nextStation]) {
    const then = baseline.weather[stationId];
    const now = liveSnap.weather[stationId];
    if (!then || !now) continue;
    const clsChanged = weatherClassOf(then) !== weatherClassOf(now);
    const dRain = Math.abs((now.rainfall ?? 0) - (then.rainfall ?? 0));
    const norm = (clsChanged ? 60 : 0) + Math.min(40, dRain);
    if (norm > weatherNorm) {
      weatherNorm = norm;
      rainDelta = dRain;
      const st = STATIONS[stationId];
      weatherDetail = `${st ? st.code : stationId.toUpperCase()}: recorded "${weatherClassOf(then)}" (${round1(then.rainfall)}mm) vs observed "${weatherClassOf(now)}" (${round1(now.rainfall)}mm)`;
    }
  }
  const weather = componentScore('weather', 'Weather drift', rainDelta, 'mm', weatherNorm, weatherDetail);

  const components = [schedule, position, prediction, weather];
  const score = round1(components.reduce((s, c) => s + c.weighted, 0));
  const driftClass = classifyDrift(score);

  const worst = [...components].sort((a, b) => b.weighted - a.weighted)[0];
  const explanation =
    `${base.trainName} drift ${score}/100 (${driftClass}). ` +
    `Largest contributor: ${worst.label.toLowerCase()} — ${worst.detail}. ` +
    components.map(c => `${c.label}: ${c.normalized}pts × ${c.weight} = ${c.weighted}`).join('; ') + '.';

  return {
    trainId: base.trainId,
    trainName: base.trainName,
    score,
    driftClass,
    components,
    baseline: {
      station: base.currentStation, nextStation: base.nextStation,
      progress: base.routeProgress, delay: base.predictedDelay, coordinates: base.coordinates,
    },
    live: {
      station: live.currentStation, nextStation: live.nextStation,
      progress: live.routeProgress, delay: live.predictedDelay, coordinates: live.coordinates,
    },
    expected: { coordinates: coordsAtKm(base.trainId, expectedKm), kmAlongRoute: round1(expectedKm) },
    explanation,
  };
}

export function computeDrift(baseline: BaselineSnapshot, live: LiveSnapshot): DriftReport {
  const capturedAt = new Date(baseline.capturedAt).getTime();
  const computedAt = new Date(live.at).getTime();
  const elapsedMinutes = Math.max(0, (computedAt - capturedAt) / 60000);

  const liveById = new Map(live.trains.map(t => [t.trainId, t]));
  const trains: TrainDrift[] = [];
  for (const base of baseline.trains) {
    const liveTrain = liveById.get(base.trainId);
    if (!liveTrain) continue;
    trains.push(driftForTrain(base, liveTrain, baseline, live, elapsedMinutes));
  }

  // Corridor score: passenger-exposure-weighted mean — a critical drift on a
  // 1,600-passenger mail train matters more than on a 750-seat Shatabdi.
  const weights = trains.map(t => {
    const baseTrain = baseline.trains.find(b => b.trainId === t.trainId);
    return Math.max(1, baseTrain?.passengerCount ?? 1000);
  });
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  const corridorScore = round1(trains.reduce((s, t, i) => s + t.score * weights[i], 0) / totalW);

  return {
    baselineId: baseline.id,
    baselineName: baseline.name,
    capturedAt: baseline.capturedAt,
    computedAt: live.at,
    elapsedMinutes: round1(elapsedMinutes),
    corridorScore,
    corridorClass: classifyDrift(corridorScore),
    trains: trains.sort((a, b) => b.score - a.score),
  };
}
