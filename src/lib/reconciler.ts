// ─────────────────────────────────────────────────────────────
// Reconciler — Round 2 "Reconciliation: Drift Indicator"
//
// Handles the three failure modes the task statement names:
//   · CONFLICTING information  — two sources disagree about the
//     same fact (weather at a station, a train's position)
//   · DUPLICATE information    — the same event arrives twice,
//     possibly with different payloads
//   · PARTIALLY MATCHING info  — a record almost identifies a
//     known entity ("Kanpur" vs "Kanpur Central" vs "CNB")
//
// Round 1's nameToId() silently mapped any unknown station name
// to 'ndls'. This module replaces that behaviour with explicit
// Jaro-Winkler similarity scoring and a needs-review queue.
// Pure module: no fs, no db, no fetch — unit-testable anywhere.
// ─────────────────────────────────────────────────────────────

import { STATIONS, TRAIN_ROUTES, haversineKm } from '../data/corridor';
import type { ReconciliationItem, ReconResolution, ReconSource, WeatherSnapshot } from '../data/types';
import { weatherClassOf } from './drift-engine';

// ── Similarity: Jaro-Winkler (favours shared prefixes, which suits
//    station names like "Kanpur" / "Kanpur Central") ──────────────

export function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length, len2 = s2.length;
  if (!len1 || !len2) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const m1: boolean[] = new Array(len1).fill(false);
  const m2: boolean[] = new Array(len2).fill(false);
  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(len2 - 1, i + matchWindow);
    for (let j = lo; j <= hi; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = m2[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

export function jaroWinkler(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  const j = jaro(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

// ── Partial matching ─────────────────────────────────────────────

export const MATCH_THRESHOLDS = { auto: 0.9, review: 0.6 } as const;

export interface MatchCandidate {
  id: string;
  label: string;
  similarity: number;
}

export interface MatchResult {
  input: string;
  status: 'exact' | 'auto' | 'review' | 'rejected';
  matchedId: string | null;
  similarity: number;
  candidates: MatchCandidate[];
}

export interface MatchContext {
  trainId?: string;
  currentStation?: string;
}

/**
 * Score an incoming free-text station reference against every known
 * station id, code and name. Never silently falls back: anything in
 * the 0.6–0.9 band lands in the needs-review queue.
 *
 * Supports two-signal Bayesian matching: combines Jaro-Winkler string
 * similarity with a spatial route prior when a train context is known.
 */
export function matchStation(input: string, context?: MatchContext): MatchResult {
  const cleaned = (input || '').toLowerCase().trim();
  if (!cleaned) return { input, status: 'rejected', matchedId: null, similarity: 0, candidates: [] };

  const routeStations = context?.trainId ? (TRAIN_ROUTES[context.trainId] || []) : [];

  const scored: MatchCandidate[] = [];
  for (const st of Object.values(STATIONS)) {
    const exact = cleaned === st.id || cleaned === st.code.toLowerCase() || cleaned === st.name.toLowerCase();
    if (exact) return { input, status: 'exact', matchedId: st.id, similarity: 1, candidates: [{ id: st.id, label: st.name, similarity: 1 }] };
    
    let sim = Math.max(
      jaroWinkler(cleaned, st.name),
      jaroWinkler(cleaned, st.code),
      // A short input may be a prefix of the full name ("Kanpur" → "Kanpur Central")
      st.name.toLowerCase().startsWith(cleaned) && cleaned.length >= 4 ? 0.85 : 0,
    );

    // Two-Signal Matching: Apply spatial route prior if train context is known
    if (routeStations.length > 0 && routeStations.includes(st.id)) {
      // Station is along the train's route: boost similarity by +0.12 (clamped to 0.99 for non-exact)
      sim = Math.min(0.99, sim + 0.12);
    }

    scored.push({ id: st.id, label: st.name, similarity: Math.round(sim * 1000) / 1000 });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const best = scored[0];
  const status = best.similarity >= MATCH_THRESHOLDS.auto ? 'auto'
    : best.similarity >= MATCH_THRESHOLDS.review ? 'review'
    : 'rejected';
  return {
    input,
    status,
    matchedId: status === 'auto' ? best.id : null,
    similarity: best.similarity,
    candidates: scored.slice(0, 3),
  };
}

/** Same idea for train numbers ("12951" vs "1295l" OCR-style typos). */
export function matchTrain(input: string): MatchResult {
  const cleaned = (input || '').toLowerCase().trim();
  if (!cleaned) return { input, status: 'rejected', matchedId: null, similarity: 0, candidates: [] };
  const ids = Object.keys(TRAIN_ROUTES);
  if (ids.includes(cleaned)) {
    return { input, status: 'exact', matchedId: cleaned, similarity: 1, candidates: [{ id: cleaned, label: cleaned, similarity: 1 }] };
  }
  const scored = ids
    .map(id => ({ id, label: id, similarity: Math.round(jaroWinkler(cleaned, id) * 1000) / 1000 }))
    .sort((a, b) => b.similarity - a.similarity);
  const best = scored[0];
  const status = best.similarity >= MATCH_THRESHOLDS.auto ? 'auto'
    : best.similarity >= MATCH_THRESHOLDS.review ? 'review'
    : 'rejected';
  return { input, status, matchedId: status === 'auto' ? best.id : null, similarity: best.similarity, candidates: scored.slice(0, 3) };
}

// ── Duplicate detection ──────────────────────────────────────────

export interface FeedEvent {
  trainId: string;
  timestamp: string;
  currentStation?: string;
  routeProgress?: number;
  speed?: number;
  source: string;
}

export interface DedupeResult {
  unique: FeedEvent[];
  /** Same key, identical payload — dropped silently but counted. */
  identicalDropped: number;
  /** Same key, different payload — a real conflict to surface. */
  conflicts: Array<{ first: FeedEvent; second: FeedEvent }>;
}

export function dedupeEvents(events: FeedEvent[]): DedupeResult {
  const seen = new Map<string, FeedEvent>();
  const unique: FeedEvent[] = [];
  const conflicts: Array<{ first: FeedEvent; second: FeedEvent }> = [];
  let identicalDropped = 0;
  for (const ev of events) {
    const key = `${ev.trainId}|${ev.timestamp}`;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, ev);
      unique.push(ev);
      continue;
    }
    const samePayload =
      prior.currentStation === ev.currentStation &&
      Math.abs((prior.routeProgress ?? 0) - (ev.routeProgress ?? 0)) < 0.001 &&
      Math.abs((prior.speed ?? 0) - (ev.speed ?? 0)) < 0.5;
    if (samePayload) identicalDropped++;
    else conflicts.push({ first: prior, second: ev });
  }
  return { unique, identicalDropped, conflicts };
}

// ── Conflict detection ───────────────────────────────────────────

let itemCounter = 0;
export function makeReconItem(
  partial: Omit<ReconciliationItem, 'id' | 'detectedAt' | 'status'>,
): ReconciliationItem {
  itemCounter++;
  return {
    ...partial,
    id: `recon-${Date.now()}-${itemCounter}`,
    detectedAt: new Date().toISOString(),
    status: 'open',
  };
}

/** Two weather sources disagreeing about the same station right now. */
export function detectWeatherConflict(
  stationId: string,
  a: (WeatherSnapshot & { name?: string }),
  b: (WeatherSnapshot & { name?: string }),
): ReconciliationItem | null {
  const clsA = weatherClassOf(a);
  const clsB = weatherClassOf(b);
  const rainDelta = Math.abs((a.rainfall ?? 0) - (b.rainfall ?? 0));
  const tempDelta = Math.abs((a.temperature ?? 0) - (b.temperature ?? 0));
  if (clsA === clsB && rainDelta < 5 && tempDelta < 5) return null;
  const st = STATIONS[stationId];
  const severity = clsA !== clsB && (clsA === 'Heavy Rain' || clsB === 'Heavy Rain' || clsA === 'Fog' || clsB === 'Fog')
    ? 'high' : clsA !== clsB ? 'moderate' : 'low';
  const sourceA: ReconSource = { name: a.name || a.source || 'Source A', value: `${clsA}, ${Math.round(a.rainfall)}mm, ${Math.round(a.temperature)}°C`, timestamp: a.fetchedAt };
  const sourceB: ReconSource = { name: b.name || b.source || 'Source B', value: `${clsB}, ${Math.round(b.rainfall)}mm, ${Math.round(b.temperature)}°C`, timestamp: b.fetchedAt };
  return makeReconItem({
    type: 'conflict',
    entity: stationId,
    entityLabel: st ? `${st.code} — ${st.name}` : stationId.toUpperCase(),
    field: 'weather',
    sourceA,
    sourceB,
    severity,
    suggestedResolution: 'merge',
    suggestion: `Sources disagree (${clsA} vs ${clsB}). Suggest merging: assume the more severe condition for delay prediction until sources converge.`,
  });
}

/** Two position estimates for the same train disagreeing beyond a threshold. */
export const POSITION_CONFLICT_KM = 40;

export function detectPositionConflict(
  trainId: string,
  trainName: string,
  feed: { coordinates: [number, number]; currentStation: string; source: string; timestamp?: string },
  engine: { coordinates: [number, number]; currentStation: string; source: string; timestamp?: string },
): ReconciliationItem | null {
  const km = haversineKm(feed.coordinates, engine.coordinates);
  if (km < POSITION_CONFLICT_KM) return null;
  const stF = STATIONS[feed.currentStation];
  const stE = STATIONS[engine.currentStation];
  const roundedKm = Math.round(km);
  return makeReconItem({
    type: 'conflict',
    entity: trainId,
    entityLabel: `${trainId} · ${trainName}`,
    field: 'position',
    divergenceKm: roundedKm,
    sourceA: { name: feed.source, value: `near ${stF ? stF.code : feed.currentStation.toUpperCase()}`, timestamp: feed.timestamp },
    sourceB: { name: engine.source, value: `near ${stE ? stE.code : engine.currentStation.toUpperCase()}`, timestamp: engine.timestamp },
    severity: km > 100 ? 'critical' : 'high',
    suggestedResolution: 'accept-live',
    suggestion: `Position estimates are ${roundedKm}km apart. Suggest accepting the live feed and flagging the schedule-derived estimate for recalibration.`,
  });
}

/** Wrap a fuzzy match that needs review into a reconciliation item. */
export function partialMatchItem(
  kind: 'station' | 'train',
  result: MatchResult,
  sourceName: string,
): ReconciliationItem | null {
  if (result.status === 'exact' || result.status === 'auto') return null;
  const best = result.candidates[0];
  const suggested: ReconResolution = result.status === 'review' ? 'merge' : 'keep-baseline';
  return makeReconItem({
    type: 'partial-match',
    entity: best ? best.id : result.input,
    entityLabel: `${kind === 'station' ? 'Station' : 'Train'} record "${result.input}"`,
    field: kind === 'station' ? 'station name' : 'train number',
    sourceA: { name: sourceName, value: `"${result.input}"` },
    sourceB: {
      name: 'RailTwin registry',
      value: best ? `closest: ${best.label} (${Math.round(best.similarity * 100)}%)` : 'no close match',
      confidence: best?.similarity,
    },
    similarity: result.similarity,
    severity: result.status === 'review' ? 'moderate' : 'high',
    suggestedResolution: suggested,
    suggestion: result.status === 'review'
      ? `${Math.round(result.similarity * 100)}% similar to ${best?.label}. Round 1 would have silently mapped this to NDLS — confirm the mapping instead.`
      : `No candidate above ${MATCH_THRESHOLDS.review * 100}% similarity. Reject the record and keep the recorded context.`,
  });
}
