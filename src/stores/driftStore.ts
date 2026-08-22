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
import { computeLivePositions, STATIONS, TRAIN_ROUTES, haversineKm } from '../data/corridor';
import { computeDrift, weatherClassOf } from '../lib/drift-engine';
import { playCriticalDriftAlert, playResolvedChime } from '../lib/alert-audio';
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
let preOverrideWeatherData: Record<string, any> = {};

function applyWeatherOverride(id: string, patch: Partial<WeatherSnapshot>) {
  replayOverrides.weather[id] = patch;
  const demo = useDemoStore.getState();
  if (demo.weatherData?.[id]) {
    if (!preOverrideWeatherData[id]) {
      preOverrideWeatherData[id] = { ...demo.weatherData[id] };
    }
    useDemoStore.setState({ weatherData: { ...demo.weatherData, [id]: { ...demo.weatherData[id], ...patch } } });
  }
}

function restorePreOverrideWeather() {
  if (Object.keys(preOverrideWeatherData).length > 0) {
    const demo = useDemoStore.getState();
    if (demo.weatherData) {
      useDemoStore.setState({
        weatherData: {
          ...demo.weatherData,
          ...preOverrideWeatherData,
        },
      });
    }
    preOverrideWeatherData = {};
  }
}

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
      snapshotAt: nowIso(),
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
    if (source === 'manual') {
      restorePreOverrideWeather();
    }
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
      feedEventsSeen: 0,
      duplicatesDropped: 0,
      timeline: pushTimeline(state, {
        at: baseline.capturedAt,
        kind: 'baseline',
        message: `Baseline "${baseline.name}" pinned (${source}) — ${baseline.trains.length} trains, ${Object.keys(baseline.weather).length} station forecasts frozen`,
      }),
    }));
    persistBaseline(baseline);
    if (source !== 'replay') {
      useDemoStore.getState().addToast({
        type: 'info',
        title: 'Baseline Pinned',
        message: `Recorded context frozen at ${new Date(baseline.capturedAt).toLocaleTimeString('en-IN', { hour12: false })}. Drift is now measured against it.`,
      });
    }
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
    let enteredCritical = false;
    for (const t of report.trains) {
      const prev = lastClassByTrain[t.trainId];
      if (prev && order.indexOf(t.driftClass) > order.indexOf(prev)) {
        const worst = [...t.components].sort((a, b) => b.weighted - a.weighted)[0];
        newEvents.push({
          at: report.computedAt,
          kind: 'drift',
          message: `${t.trainId} ${t.trainName}: drift ${prev} → ${t.driftClass} (${t.score}/100) — ${worst.detail}`,
        });
        if (t.driftClass === 'critical') enteredCritical = true;
      }
      lastClassByTrain[t.trainId] = t.driftClass;
    }
    if (enteredCritical && useDemoStore.getState().audioEnabled) {
      playCriticalDriftAlert();
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
    const scoreBefore = get().driftReport?.corridorScore ?? null;
    const classBefore = get().driftReport?.corridorClass ?? null;

    set(state => ({
      reconItems: state.reconItems.map(i => (i.id === id ? resolved : i)),
      timeline: pushTimeline(state, {
        at: resolved.resolvedAt!,
        kind: 'resolution',
        message: `Operator resolved ${item.type} on ${item.entityLabel} (${item.field}): ${resolution.replace('-', ' ')}`,
      }),
    }));

    // ── Closed loop: the decision changes live state, not just a flag ──
    const demo = useDemoStore.getState();
    const { baseline } = get();
    const entity = item.entity;
    if (baseline) {
      if (resolution === 'accept-live' || resolution === 'merge') {
        // Accepting reality: the observed values become the recorded context
        // for this entity, re-anchored at this moment — drift against the
        // updated context collapses.
        const live = buildLiveSnapshot();
        const liveTrain = live.trains.find(t => t.trainId === entity);
        const updatedTrains = liveTrain
          ? baseline.trains.map(t => (t.trainId === entity ? liveTrain : t))
          : baseline.trains;
        const updatedWeather = { ...baseline.weather };
        if (live.weather[entity]) {
          if (resolution === 'merge' && baseline.weather[entity]) {
            // Merge = operate on the more severe of the two conditions
            const a = baseline.weather[entity];
            const b = live.weather[entity];
            updatedWeather[entity] = b.rainfall >= a.rainfall ? b : a;
          } else {
            updatedWeather[entity] = live.weather[entity];
          }
          // Propagate the accepted weather to the whole dashboard
          if (demo.weatherData?.[entity]) {
            useDemoStore.setState({
              weatherData: {
                ...demo.weatherData,
                [entity]: { ...demo.weatherData[entity], ...updatedWeather[entity] },
              },
            });
          }
        }
        const newBaseline: BaselineSnapshot = { ...baseline, trains: updatedTrains, weather: updatedWeather };
        set({ baseline: newBaseline });
        persistBaseline(newBaseline);
      } else {
        // Keep baseline: the incoming record is judged wrong — discard the
        // drifting overrides for this entity and restore the recorded values.
        delete replayOverrides.delays[entity];
        delete replayOverrides.weather[entity];
        if (baseline.weather[entity] && demo.weatherData?.[entity]) {
          useDemoStore.setState({
            weatherData: {
              ...demo.weatherData,
              [entity]: { ...demo.weatherData[entity], ...baseline.weather[entity] },
            },
          });
        }
      }
    }

    // Recompute immediately so the decision has a visible consequence
    get().computeDriftNow();
    const after = get().driftReport;
    if (scoreBefore !== null && after && (scoreBefore - after.corridorScore >= 10 || (classBefore !== after.corridorClass && after.corridorClass === 'stable'))) {
      useDemoStore.getState().addToast({
        type: 'success',
        title: 'Drift Mitigated',
        message: `Corridor drift ${Math.round(scoreBefore)} → ${Math.round(after.corridorScore)} (${after.corridorClass.toUpperCase()}) after reconciliation.`,
      });
      if (useDemoStore.getState().audioEnabled) playResolvedChime();
      set(state => ({
        timeline: pushTimeline(state, {
          at: nowIso(),
          kind: 'resolution',
          message: `Drift mitigated: corridor ${Math.round(scoreBefore)} → ${Math.round(after.corridorScore)} (${after.corridorClass})`,
        }),
      }));
    } else {
      useDemoStore.getState().addToast({
        type: 'success',
        title: 'Reconciled',
        message: `${item.entityLabel}: ${resolution.replace('-', ' ')} applied and written to the audit log.`,
      });
    }

    fetch(`${getBaseUrl()}api/reconciliation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: resolved, resolution }),
    }).catch(() => { /* audit persistence is best-effort */ });
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

    const baseDelay = (id: string) =>
      get().baseline?.trains.find(t => t.trainId === id)?.predictedDelay ?? 0;

    // t=8s · unforecast heavy rain hits Punjab Mail (12137) target stations
    schedule(8000, () => {
      const t12137 = useDemoStore.getState().trains.find(t => t.id === '12137');
      const hitNext = t12137?.nextStation ?? 'bsl';
      const hitCur  = t12137?.currentStation ?? 'bpl';
      const code = (id: string) => STATIONS[id]?.code ?? id.toUpperCase();
      applyWeatherOverride(hitNext, { rainfall: 62, description: 'Violent rain showers', visibility: 2.5 });
      applyWeatherOverride(hitCur,  { rainfall: 24, description: 'Moderate rain', visibility: 5 });
      step(`Weather drift — heavy rain at ${code(hitNext)} not in the recorded forecast`);
      demo.addToast({ type: 'warning', title: 'Weather Drift', message: `${code(hitNext)} now reports 62mm/hr rain. The recorded forecast said clear.` });
      get().computeDriftNow();
    });

    // t=18s · the delay picture moves relative to recorded baseline
    schedule(18000, () => {
      replayOverrides.delays['12137'] = baseDelay('12137') + 28;
      replayOverrides.delays['12951'] = baseDelay('12951') + 12;
      get().computeDriftNow();
      const t18 = get().driftReport?.trains.find(x => x.trainId === '12137');
      step(`Schedule drift — 12137 delay +28min (${t18?.driftClass ?? 'minor'} drift, ${Math.round(t18?.score ?? 0)}/100)`);
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

    // t=44s · deliberate position conflict for 12625 (Kerala Exp) 2 stations behind engine
    schedule(44000, () => {
      const t12625 = useDemoStore.getState().trains.find(t => t.id === '12625');
      const route = TRAIN_ROUTES['12625'] || [];
      const curSt = t12625?.currentStation || 'bpl';
      const curIdx = route.indexOf(curSt);
      const targetIdx = curIdx >= 2 ? curIdx - 2 : Math.min(route.length - 1, curIdx + 2);
      const ghostStId = route[targetIdx] || 'ngp';
      const ghostSt = STATIONS[ghostStId];
      const ghostCoords = ghostSt ? ghostSt.coordinates : ([79.0, 21.1] as [number, number]);
      const liveCoords = t12625?.coordinates || ([77.4, 23.2] as [number, number]);

      const item = detectPositionConflict(
        '12625',
        t12625?.name || 'Kerala Express',
        { coordinates: ghostCoords, currentStation: ghostStId, source: 'NTES-style feed B', timestamp: nowIso() },
        { coordinates: liveCoords, currentStation: curSt, source: 'Position engine (schedule-derived)', timestamp: nowIso() },
      );
      if (item) {
        set(state => ({
          reconItems: [item, ...state.reconItems.filter(i => i.id !== item.id)].slice(0, 40),
          timeline: pushTimeline(state, {
            at: nowIso(),
            kind: 'conflict',
            message: `Position conflict: 12625 Kerala Exp — NTES feed B reports near ${ghostSt?.code || ghostStId.toUpperCase()} vs engine near ${STATIONS[curSt]?.code || curSt.toUpperCase()}`,
          }),
        }));
        demo.addToast({
          type: 'warning',
          title: 'Position Conflict',
          message: `12625 Kerala Exp: Feed B reports at ${ghostSt?.code || ghostStId.toUpperCase()} (~${Math.round(haversineKm(ghostCoords, liveCoords))}km divergence).`,
        });
        step(`Position conflict — 12625 Feed B (${ghostSt?.code || ghostStId.toUpperCase()}) vs timetable engine`);
      }
    });

    // t=50s · escalate: delay moves +48min relative to baseline, reaching critical/significant
    schedule(50000, () => {
      replayOverrides.delays['12137'] = baseDelay('12137') + 48;
      get().computeDriftNow();
      const t50 = get().driftReport?.trains.find(x => x.trainId === '12137');
      step(`Drift ${t50?.driftClass ?? 'significant'} on 12137 (${Math.round(t50?.score ?? 0)}/100) — operator action required`);
    });

    // t=62s · wrap up
    schedule(62000, () => {
      step('Replay complete — reconcile the open items in the inbox');
      demo.addToast({ type: 'info', title: 'Replay Complete', message: 'Resolve the open conflicts with Accept live / Keep baseline / Merge.' });
      set(state => ({
        replayActive: false,
        timeline: pushTimeline(state, { at: nowIso(), kind: 'replay', message: 'Replay scenario finished' }),
      }));
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const inboxEl = document.getElementById('recon-inbox-section');
          if (inboxEl) {
            inboxEl.scrollIntoView({ behavior: 'smooth' });
            inboxEl.classList.add('drift-critical-pulse');
            setTimeout(() => inboxEl.classList.remove('drift-critical-pulse'), 3000);
          }
        }, 100);
      }
    });
  },

  stopReplay: (silent = false) => {
    for (const t of replayTimeouts) clearTimeout(t);
    replayTimeouts = [];
    replayOverrides = { delays: {}, weather: {} };
    restorePreOverrideWeather();
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
