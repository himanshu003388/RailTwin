// ─────────────────────────────────────────────────────────────
// Drift Store — Round 2 "Reconciliation: Drift Indicator"
//
// Orchestrates the drift/reconciliation layer on the client:
//  · captures & restores the baseline ("recorded context")
//  · recomputes the drift report every 5s from live state
//  · consumes the SSE feed as an independent "Source B" and runs
//    the reconciler against the schedule-derived position engine
//  · fetches dual-source weather to surface genuine conflicts
//  · drives the deterministic 60s replay scenario for demos
//
// It deliberately lives beside demoStore rather than inside it:
// Round 2 is an extension, not a rebuild.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { useDemoStore } from './demoStore';
import { computeLivePositions, STATIONS } from '../data/corridor';
import { computeDrift, weatherClassOf } from '../lib/drift-engine';
import {
  dedupeEvents,
  detectPositionConflict,
  detectWeatherConflict,
  makeReconItem,
  matchStation,
  matchTrain,
  partialMatchItem,
  type FeedEvent,
} from '../lib/reconciler';
import type {
  BaselineSnapshot,
  BaselineTrainSnapshot,
  DriftReport,
  DriftTimelineEvent,
  LiveSnapshot,
  ReconciliationItem,
  ReconResolution,
  WeatherSnapshot,
} from '../data/types';

const BASELINE_STORAGE_KEY = 'railtwin-baseline-v1';
const MAX_OPEN_POSITION_CONFLICTS = 2;
const HISTORY_POINTS = 48;

interface ReplayOverrides {
  delays: Record<string, number>;
  weather: Record<string, Partial<WeatherSnapshot>>;
}

interface DriftState {
  baseline: BaselineSnapshot | null;
  driftReport: DriftReport | null;
  reconItems: ReconciliationItem[];
  timeline: DriftTimelineEvent[];
  corridorHistory: Array<{ t: number; score: number }>;
  trainHistory: Record<string, number[]>;
  duplicatesDropped: number;
  feedEventsSeen: number;
  replayActive: boolean;
  replayStep: string | null;

  captureBaseline: (name?: string, source?: BaselineSnapshot['source']) => void;
  computeDriftNow: () => void;
  resolveItem: (id: string, resolution: ReconResolution) => void;
  ingestFeedEvents: (events: FeedEvent[]) => void;
  startReplay: () => void;
  stopReplay: (silent?: boolean) => void;
}

let replayOverrides: ReplayOverrides = { delays: {}, weather: {} };
let replayTimeouts: ReturnType<typeof setTimeout>[] = [];
let lastClassByTrain: Record<string, string> = {};

function getBaseUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function nowIso() {
  return new Date().toISOString();
}

function toWeatherSnapshot(w: any): WeatherSnapshot {
  return {
    rainfall: w?.rainfall ?? 0,
    description: w?.description ?? 'Clear sky',
    temperature: w?.temperature ?? 27,
    visibility: w?.visibility ?? 10,
    source: w?.source ?? 'unknown',
  };
}

/** Assemble the current situation in baseline shape, applying any replay overrides. */
function buildLiveSnapshot(): LiveSnapshot {
  const demo = useDemoStore.getState();
  const weather: Record<string, WeatherSnapshot> = {};
  if (demo.weatherData) {
    for (const [code, w] of Object.entries(demo.weatherData)) {
      weather[code] = toWeatherSnapshot(w);
    }
  }
  for (const [code, patch] of Object.entries(replayOverrides.weather)) {
    weather[code] = { ...toWeatherSnapshot(weather[code]), ...patch };
  }

  const confidenceByTrain: Record<string, number> = {};
  for (const p of demo.predictions) confidenceByTrain[p.trainId] = p.confidence;

  const trains: BaselineTrainSnapshot[] = demo.trains.map(t => {
    const delayOverride = replayOverrides.delays[t.id];
    return {
      trainId: t.id,
      trainName: t.name,
      currentStation: t.currentStation,
      nextStation: t.nextStation,
      routeProgress: t.routeProgress,
      coordinates: t.coordinates,
      speed: t.speed,
      passengerCount: t.passengerCount,
      predictedDelay: delayOverride !== undefined ? delayOverride : t.predictedDelay,
      confidence: confidenceByTrain[t.id] ?? 0.65,
      weatherConditionAtNext: weatherClassOf(weather[t.nextStation]),
    };
  });

  return { at: nowIso(), trains, weather };
}

function persistBaseline(baseline: BaselineSnapshot) {
  try {
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
  } catch { /* storage unavailable */ }
  fetch(`${getBaseUrl()}api/baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(baseline),
  }).catch(() => { /* server persistence is best-effort */ });
}

function restoreBaseline(): BaselineSnapshot | null {
  try {
    const raw = localStorage.getItem(BASELINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.capturedAt || !Array.isArray(parsed?.trains)) return null;
    // A baseline older than a control-room shift (12h) is no longer the
    // operative recorded context — start fresh instead.
    const ageMs = Date.now() - new Date(parsed.capturedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 12 * 3600 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function pushTimeline(state: DriftState, event: DriftTimelineEvent): DriftTimelineEvent[] {
  return [event, ...state.timeline].slice(0, 60);
}

function hasOpenItem(items: ReconciliationItem[], entity: string, field: string): boolean {
  return items.some(i => i.status === 'open' && i.entity === entity && i.field === field);
}

export const useDriftStore = create<DriftState>((set, get) => ({
  baseline: null,
  driftReport: null,
  reconItems: [],
  timeline: [],
  corridorHistory: [],
  trainHistory: {},
  duplicatesDropped: 0,
  feedEventsSeen: 0,
  replayActive: false,
  replayStep: null,

  captureBaseline: (name, source = 'manual') => {
    const live = buildLiveSnapshot();
    const baseline: BaselineSnapshot = {
      id: `bl-${Date.now()}`,
      name: name || `Baseline ${new Date().toLocaleTimeString('en-IN', { hour12: false })}`,
      capturedAt: live.at,
      source,
      trains: live.trains,
      weather: live.weather,
    };
    lastClassByTrain = {};
    set(state => ({
      baseline,
      corridorHistory: [],
      trainHistory: {},
      timeline: pushTimeline(state, {
        at: baseline.capturedAt,
        kind: 'baseline',
        message: `Baseline "${baseline.name}" pinned (${source}) — ${baseline.trains.length} trains, ${Object.keys(baseline.weather).length} station forecasts frozen`,
      }),
    }));
    persistBaseline(baseline);
    useDemoStore.getState().addToast({
      type: 'info',
      title: 'Baseline Pinned',
      message: `Recorded context frozen at ${new Date(baseline.capturedAt).toLocaleTimeString('en-IN', { hour12: false })}. Drift is now measured against it.`,
    });
    get().computeDriftNow();
  },

  computeDriftNow: () => {
    const { baseline } = get();
    if (!baseline) return;
    const live = buildLiveSnapshot();
    if (live.trains.length === 0) return;
    const report = computeDrift(baseline, live);

    // Timeline entries when a train's drift class worsens
    const order = ['stable', 'minor', 'significant', 'critical'];
    const newEvents: DriftTimelineEvent[] = [];
    for (const t of report.trains) {
      const prev = lastClassByTrain[t.trainId];
      if (prev && order.indexOf(t.driftClass) > order.indexOf(prev)) {
        const worst = [...t.components].sort((a, b) => b.weighted - a.weighted)[0];
        newEvents.push({
          at: report.computedAt,
          kind: 'drift',
          message: `${t.trainId} ${t.trainName}: drift ${prev} → ${t.driftClass} (${t.score}/100) — ${worst.detail}`,
        });
      }
      lastClassByTrain[t.trainId] = t.driftClass;
    }

    set(state => {
      const corridorHistory = [...state.corridorHistory, { t: Date.now(), score: report.corridorScore }].slice(-HISTORY_POINTS);
      const trainHistory = { ...state.trainHistory };
      for (const t of report.trains) {
        trainHistory[t.trainId] = [...(trainHistory[t.trainId] || []), t.score].slice(-HISTORY_POINTS);
      }
      let timeline = state.timeline;
      for (const ev of newEvents.reverse()) timeline = [ev, ...timeline].slice(0, 60);
      return { driftReport: report, corridorHistory, trainHistory, timeline };
    });
  },

  resolveItem: (id, resolution) => {
    const item = get().reconItems.find(i => i.id === id);
    if (!item || item.status === 'resolved') return;
    const resolved: ReconciliationItem = { ...item, status: 'resolved', resolution, resolvedAt: nowIso() };
    set(state => ({
      reconItems: state.reconItems.map(i => (i.id === id ? resolved : i)),
      timeline: pushTimeline(state, {
        at: resolved.resolvedAt!,
        kind: 'resolution',
        message: `Operator resolved ${item.type} on ${item.entityLabel} (${item.field}): ${resolution.replace('-', ' ')}`,
      }),
    }));
    fetch(`${getBaseUrl()}api/reconciliation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: resolved, resolution }),
    }).catch(() => { /* audit persistence is best-effort */ });
    useDemoStore.getState().addToast({
      type: 'success',
      title: 'Reconciled',
      message: `${item.entityLabel}: ${resolution.replace('-', ' ')} applied and written to the audit log.`,
    });
  },

  ingestFeedEvents: (events) => {
    const { unique, identicalDropped, conflicts } = dedupeEvents(events);
    const newItems: ReconciliationItem[] = [];
    const newTimeline: DriftTimelineEvent[] = [];

    for (const c of conflicts) {
      const stA = STATIONS[c.first.currentStation || ''];
      const stB = STATIONS[c.second.currentStation || ''];
      newItems.push(makeReconItem({
        type: 'duplicate',
        entity: c.first.trainId,
        entityLabel: `${c.first.trainId} feed event @ ${new Date(c.first.timestamp).toLocaleTimeString('en-IN', { hour12: false })}`,
        field: 'feed event',
        sourceA: {
          name: c.first.source,
          value: `${stA ? stA.code : c.first.currentStation} · progress ${(100 * (c.first.routeProgress ?? 0)).toFixed(0)}%`,
          timestamp: c.first.timestamp,
        },
        sourceB: {
          name: c.second.source,
          value: `${stB ? stB.code : c.second.currentStation} · progress ${(100 * (c.second.routeProgress ?? 0)).toFixed(0)}%`,
          timestamp: c.second.timestamp,
        },
        severity: 'moderate',
        suggestedResolution: 'accept-live',
        suggestion: 'Two events share the same train and timestamp but carry different payloads. Suggest keeping the latest-received value and discarding the earlier one.',
      }));
      newTimeline.push({
        at: nowIso(),
        kind: 'duplicate',
        message: `Duplicate event detected for ${c.first.trainId}: same timestamp, conflicting payloads`,
      });
    }

    set(state => {
      let timeline = state.timeline;
      for (const ev of newTimeline) timeline = [ev, ...timeline].slice(0, 60);
      return {
        feedEventsSeen: state.feedEventsSeen + events.length,
        duplicatesDropped: state.duplicatesDropped + identicalDropped,
        reconItems: [...newItems, ...state.reconItems].slice(0, 40),
        timeline,
      };
    });
    return unique;
  },

  startReplay: () => {
    const { replayActive, stopReplay, captureBaseline } = get();
    if (replayActive) stopReplay(true);
    // Always start from a clean slate — a previous finished replay leaves
    // its overrides in place for demo visibility.
    for (const t of replayTimeouts) clearTimeout(t);
    replayTimeouts = [];
    replayOverrides = { delays: {}, weather: {} };
    const demo = useDemoStore.getState();
    const step = (label: string) => set({ replayStep: label });

    set(state => ({
      replayActive: true,
      timeline: pushTimeline(state, { at: nowIso(), kind: 'replay', message: 'Replay scenario started — deterministic 60s drift story' }),
    }));

    // t=0 · pin the recorded context
    captureBaseline('Shift start (replay)', 'replay');
    step('Baseline pinned — network stable');

    const schedule = (ms: number, fn: () => void) => {
      replayTimeouts.push(setTimeout(() => { if (get().replayActive) fn(); }, ms));
    };

    // t=8s · unforecast heavy rain at Bhusaval hits Punjab Mail (12137)
    schedule(8000, () => {
      replayOverrides.weather['bsl'] = { rainfall: 62, description: 'Violent rain showers', visibility: 2.5 };
      replayOverrides.weather['bpl'] = { rainfall: 24, description: 'Moderate rain', visibility: 5 };
      step('Weather drift — heavy rain at BSL not in the recorded forecast');
      demo.addToast({ type: 'warning', title: 'Weather Drift', message: 'BSL now reports 62mm/hr rain. The recorded forecast said clear.' });
      get().computeDriftNow();
    });

    // t=18s · the delay picture moves far from the recorded context
    schedule(18000, () => {
      replayOverrides.delays['12137'] = 42;
      replayOverrides.delays['12951'] = 21;
      step('Schedule drift — 12137 delay 42min vs recorded context');
      get().computeDriftNow();
    });

    // t=28s · duplicate feed events arrive for 12951
    schedule(28000, () => {
      const ts = nowIso();
      get().ingestFeedEvents([
        { trainId: '12951', timestamp: ts, currentStation: 'rtm', routeProgress: 0.42, speed: 118, source: 'SSE feed (packet 1)' },
        { trainId: '12951', timestamp: ts, currentStation: 'brc', routeProgress: 0.31, speed: 124, source: 'SSE feed (packet 2)' },
      ]);
      step('Duplicate feed events for 12951 — same timestamp, different payloads');
    });

    // t=38s · partially matching records from a second feed
    schedule(38000, () => {
      const stationItem = partialMatchItem('station', matchStation('Kanpur Centrall'), 'NTES-style feed B');
      const trainItem = partialMatchItem('train', matchTrain('1295l'), 'NTES-style feed B');
      const items = [stationItem, trainItem].filter(Boolean) as ReconciliationItem[];
      set(state => {
        let timeline = state.timeline;
        for (const i of items) {
          timeline = [{ at: nowIso(), kind: 'partial-match' as const, message: `Partial match queued for review: ${i.sourceA.value} (${Math.round((i.similarity ?? 0) * 100)}% similar)` }, ...timeline].slice(0, 60);
        }
        return { reconItems: [...items, ...state.reconItems].slice(0, 40), timeline };
      });
      step('Partial matches — "Kanpur Centrall" & train "1295l" need review');
      demo.addToast({ type: 'warning', title: 'Needs Review', message: 'Incoming records only partially match the registry. Round 1 would have silently mapped them to NDLS.' });
    });

    // t=50s · escalate: the rain cascades, drift goes critical
    schedule(50000, () => {
      replayOverrides.delays['12137'] = 55;
      step('Drift critical on 12137 — operator action required');
      get().computeDriftNow();
    });

    // t=62s · wrap up
    schedule(62000, () => {
      step('Replay complete — reconcile the open items in the inbox');
      demo.addToast({ type: 'info', title: 'Replay Complete', message: 'Resolve the open conflicts with Accept live / Keep baseline / Merge.' });
      set(state => ({
        replayActive: false,
        timeline: pushTimeline(state, { at: nowIso(), kind: 'replay', message: 'Replay scenario finished' }),
      }));
      // Overrides stay in place so the drifted state remains visible for the demo;
      // they clear on the next manual baseline pin or stopReplay().
    });
  },

  stopReplay: (silent = false) => {
    for (const t of replayTimeouts) clearTimeout(t);
    replayTimeouts = [];
    replayOverrides = { delays: {}, weather: {} };
    set({ replayActive: false, replayStep: null });
    if (!silent) {
      useDemoStore.getState().addToast({ type: 'info', title: 'Replay Stopped', message: 'Overrides cleared. Live drift resumes.' });
      get().computeDriftNow();
    }
  },
}));

// ─────────────────────────────────────────────────────────────
// Client-side wiring: restore/auto-capture baseline, 5s drift
// tick, SSE "Source B" consumption, dual-source weather checks.
// ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  // Restore a stored baseline immediately so refreshes keep the shift context
  const stored = restoreBaseline();
  if (stored) {
    useDriftStore.setState({ baseline: stored });
  }

  // Wait for demoStore's initial load, then auto-capture if nothing is pinned
  const waitForLoad = setInterval(() => {
    const demo = useDemoStore.getState();
    if (demo.loading) return;
    clearInterval(waitForLoad);
    if (!useDriftStore.getState().baseline) {
      useDriftStore.getState().captureBaseline('Shift start (auto)', 'auto');
    } else {
      useDriftStore.getState().computeDriftNow();
    }
  }, 800);

  // Drift tick every 5s
  setInterval(() => {
    useDriftStore.getState().computeDriftNow();
  }, 5000);

  // SSE feed as independent Source B → duplicates + position conflicts
  setTimeout(() => {
    try {
      const es = new EventSource(`${getBaseUrl()}api/sse/train-updates`);
      es.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          const feedTrains: any[] = payload?.trains || [];
          const ts = payload?.timestamp || nowIso();
          const events: FeedEvent[] = feedTrains.map(t => ({
            trainId: t.id,
            timestamp: ts,
            currentStation: t.currentStation,
            routeProgress: t.routeProgress,
            speed: t.speed,
            source: 'SSE feed',
          }));
          useDriftStore.getState().ingestFeedEvents(events);

          // Cross-check feed positions against the schedule-derived engine
          const enginePositions = computeLivePositions();
          const state = useDriftStore.getState();
          const demo = useDemoStore.getState();
          const openPositionConflicts = state.reconItems.filter(
            i => i.status === 'open' && i.field === 'position'
          ).length;
          if (openPositionConflicts < MAX_OPEN_POSITION_CONFLICTS) {
            let worst: { item: ReconciliationItem; km: number } | null = null;
            for (const ft of feedTrains) {
              if (hasOpenItem(state.reconItems, ft.id, 'position')) continue;
              const engine = enginePositions.find(p => p.id === ft.id);
              const train = demo.trains.find(t => t.id === ft.id);
              if (!engine || !train || !Array.isArray(ft.coordinates)) continue;
              const item = detectPositionConflict(
                ft.id,
                train.name,
                { coordinates: ft.coordinates, currentStation: ft.currentStation, source: 'SSE feed snapshot', timestamp: ts },
                { coordinates: engine.coordinates, currentStation: engine.currentStation, source: 'Position engine (schedule-derived)', timestamp: nowIso() },
              );
              if (item) {
                const km = parseFloat((item.suggestion.match(/(\d+)km/) || [])[1] || '0');
                if (!worst || km > worst.km) worst = { item, km };
              }
            }
            if (worst) {
              useDriftStore.setState(s => ({
                reconItems: [worst!.item, ...s.reconItems].slice(0, 40),
                timeline: [{ at: nowIso(), kind: 'conflict' as const, message: `Position conflict: ${worst!.item.entityLabel} — feed vs engine disagree by ~${Math.round(worst!.km)}km` }, ...s.timeline].slice(0, 60),
              }));
            }
          }
        } catch { /* malformed SSE frame */ }
      };
      es.onerror = () => { /* SSE reconnects automatically */ };
    } catch { /* EventSource unavailable */ }
  }, 4000);

  // Dual-source weather conflict check: on load and every 3 minutes
  const checkWeatherConflict = async () => {
    try {
      const demo = useDemoStore.getState();
      const state = useDriftStore.getState();
      const target = demo.weatherAlert?.station || 'bsl';
      if (hasOpenItem(state.reconItems, target, 'weather')) return;
      const res = await fetch(`${getBaseUrl()}api/weather/compare?station=${target}`);
      if (!res.ok) return;
      const dual = await res.json();
      if (!dual?.sourceA?.data || !dual?.sourceB?.data) return;
      const item = detectWeatherConflict(
        target,
        { ...dual.sourceA.data, name: dual.sourceA.name },
        { ...dual.sourceB.data, name: dual.sourceB.name },
      );
      if (item) {
        useDriftStore.setState(s => ({
          reconItems: [item, ...s.reconItems].slice(0, 40),
          timeline: [{ at: nowIso(), kind: 'conflict' as const, message: `Weather source conflict at ${item.entityLabel}: ${dual.sourceA.name} vs ${dual.sourceB.name}` }, ...s.timeline].slice(0, 60),
        }));
      }
    } catch { /* best-effort */ }
  };
  setTimeout(checkWeatherConflict, 12000);
  setInterval(checkWeatherConflict, 180000);
}
