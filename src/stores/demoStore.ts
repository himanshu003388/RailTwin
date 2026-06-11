import { create } from 'zustand';
import { CORRIDOR, TRAINS, SORTED_STATIONS, interpolateTrainPosition, getCorridorDistance, type Train } from '../data/corridor';
import { DEMO_TIMELINE } from '../data/mockScenario';
import { fetchLiveTrainStatus, normalizeLiveTrainData } from '../services/railwayService';
import { HistoricalDelayPredictionEngine } from '../services/HistoricalDelayPredictionEngine';
import { railwayDataset } from '../services/RailwayDatasetService';

export interface CopilotMessage {
  id: string;
  sender: 'system' | 'user' | 'copilot';
  message: string;
  timestamp: Date;
}

export interface Recommendation {
  id: string;
  priority: number;
  action: string;
  impact: string;
  accepted?: boolean;
}

export interface StationRisk {
  crowdRisk: 'low' | 'moderate' | 'high' | 'critical';
  delayRisk: 'low' | 'moderate' | 'high' | 'critical';
  platformConflicts: number;
}

export interface Toast {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'ai';
  title: string;
  message: string;
}

export interface WhatIfResult {
  station: string;
  scenario: string;
  affectedTrains: string[];
  cascadeDelay: number;
  passengersAtRisk: number;
  conflictsGenerated: number;
  riskLevels: Record<string, { crowdRisk: string; delayRisk: string }>;
}

export interface NetworkHealth {
  efficiency: number; // 0-100
  onTimePerf: number; // 0-100
  platformUtil: number; // 0-100
  signalStatus: 'operational' | 'degraded' | 'disrupted';
  activeAlerts: number;
}

export interface DemoState {
  demoRunning: boolean;
  demoTime: number;
  isPaused: boolean;
  playbackSpeed: number;
  weatherAlert: null | { station: string; rainfall: number; description: string };
  trains: Train[];
  stationRisks: Record<string, StationRisk>;
  predictions: Array<{
    trainId: string;
    delayMinutes: number;
    affectedStation: string;
    confidence: number;
    timestamp: number;
    explanation?: string;
  }>;
  simulation: null | {
    conflictsDetected: number;
    cascadeDelay: number;
    passengersAffected: number;
    stationsImpacted: string[];
    running: boolean;
  };
  copilot: {
    thinking: boolean;
    messages: CopilotMessage[];
    recommendations: Recommendation[];
  };
  intervention: null | { accepted: string; operator: string };
  resolved: null | {
    newCascadeDelay: number;
    conflictsResolved: number;
    riskReduction: string;
    minutesSaved: number;
  };
  activePanel: 'map' | 'delays' | 'simulation' | 'copilot' | 'whatif' | 'health';
  toasts: Toast[];
  whatIfStation: string;
  whatIfScenario: 'rainfall' | 'signal_failure' | 'track_damage' | 'fog';
  whatIfResult: WhatIfResult | null;
  networkHealth: NetworkHealth;
  audioEnabled: boolean;
  theme: 'dark' | 'light';
  liveApiEnabled: boolean;
  rapidApiKey: string;
  rapidApiHost: string;
  apiStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  geminiApiKey: string;
  stations: any[];
  mobileLeftOpen: boolean;
  mobileRightOpen: boolean;

  // Actions
  setMobileLeftOpen: (open: boolean) => void;
  setMobileRightOpen: (open: boolean) => void;
  startDemo: () => void;
  resetDemo: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;
  seekTo: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setActivePanel: (panel: 'map' | 'delays' | 'simulation' | 'copilot' | 'whatif' | 'health') => void;
  acceptRecommendation: (id: string) => void;
  tickDemo: (second: number) => void | Promise<void>;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setWhatIfStation: (station: string) => void;
  setWhatIfScenario: (scenario: 'rainfall' | 'signal_failure' | 'track_damage' | 'fog') => void;
  runWhatIf: () => void;
  toggleAudio: () => void;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setApiConfig: (config: { enabled: boolean, key: string, host: string }) => void;
  setGeminiApiKey: (key: string) => void;
  updateLiveTrainsFromApi: () => Promise<void>;
}

// Global timers references
let timerInterval: any = null;
let eventTimeouts: any[] = [];

// Concurrency guard for live API updates
let liveApiUpdating = false;

const nameToIdMap: Record<string, string> = {
  'new delhi': 'ndls',
  'kanpur central': 'cnb',
  'kanpur': 'cnb',
  'prayagraj junction': 'ald',
  'allahabad': 'ald',
  'prayagraj': 'ald',
  'varanasi junction': 'bsb',
  'varanasi': 'bsb',
  'patna junction': 'pnbe',
  'patna': 'pnbe',
  'dhanbad junction': 'dhn',
  'dhanbad': 'dhn',
  'howrah junction': 'hwh',
  'howrah': 'hwh',
  'lucknow charbagh': 'lko',
  'lucknow': 'lko'
};

function nameToId(name: string): string {
  if (!name) return 'ndls';
  return nameToIdMap[name.toLowerCase()] || 'ndls';
}

const createInitialStationRisks = (stationsList?: any[]): Record<string, StationRisk> => {
  const risks: Record<string, StationRisk> = {};
  const list = stationsList || CORRIDOR.stations;
  list.forEach(station => {
    risks[station.id] = {
      crowdRisk: 'low',
      delayRisk: 'low',
      platformConflicts: 0
    };
  });
  return risks;
};

const computeNetworkHealth = (
  trains: Train[],
  stationRisks: Record<string, StationRisk>,
  simulation: DemoState['simulation'],
  weatherAlert: DemoState['weatherAlert']
): NetworkHealth => {
  const totalDelay = trains.reduce((sum, t) => sum + t.predictedDelay, 0);
  const avgDelay = trains.length > 0 ? totalDelay / trains.length : 0;
  const onTimeTrains = trains.filter(t => t.predictedDelay === 0).length;
  const onTimePerf = trains.length > 0 ? Math.round((onTimeTrains / trains.length) * 100) : 100;

  const totalCapacity = trains.reduce((sum, t) => sum + t.capacity, 0);
  const totalPassengers = trains.reduce((sum, t) => sum + t.passengerCount, 0);
  const platformUtil = totalCapacity > 0 ? Math.round((totalPassengers / totalCapacity) * 100) : 0;

  const hasCritical = Object.values(stationRisks).some(r => r.crowdRisk === 'critical' || r.delayRisk === 'critical');
  const hasHigh = Object.values(stationRisks).some(r => r.crowdRisk === 'high' || r.delayRisk === 'high');
  const signalStatus = hasCritical ? 'disrupted' : hasHigh ? 'degraded' : 'operational';

  const efficiency = Math.max(0, Math.min(100, Math.round(100 - avgDelay * 2 - (simulation?.conflictsDetected || 0) * 10)));
  const activeAlerts = (weatherAlert ? 1 : 0) + (simulation ? simulation.conflictsDetected : 0);

  return { efficiency, onTimePerf, platformUtil, signalStatus, activeAlerts };
};

const initialStoreState = {
  demoRunning: false,
  demoTime: 0,
  isPaused: false,
  playbackSpeed: 1,
  weatherAlert: null,
  stations: JSON.parse(JSON.stringify(CORRIDOR.stations)),
  trains: JSON.parse(JSON.stringify(TRAINS)),
  stationRisks: createInitialStationRisks(CORRIDOR.stations),
  predictions: [],
  simulation: null,
  copilot: {
    thinking: false,
    messages: [
      {
        id: 'init-msg',
        sender: 'system' as const,
        message: 'RailTwin Operations Center Initialized. Awaiting weather data...',
        timestamp: new Date()
      }
    ],
    recommendations: []
  },
  intervention: null,
  resolved: null,
  activePanel: 'map' as const,
  toasts: [],
  whatIfStation: 'pnbe',
  whatIfScenario: 'rainfall' as const,
  whatIfResult: null,
  networkHealth: { efficiency: 100, onTimePerf: 100, platformUtil: 73, signalStatus: 'operational' as const, activeAlerts: 0 },
  audioEnabled: false,
  theme: ((typeof window !== 'undefined' && localStorage.getItem('theme') === 'light') ? 'light' : 'dark') as 'dark' | 'light',
  liveApiEnabled: typeof window !== 'undefined' ? localStorage.getItem('railtwin-api-enabled') === 'true' : false,
  rapidApiKey: typeof window !== 'undefined' ? localStorage.getItem('railtwin-rapidapi-key') || '' : '',
  rapidApiHost: typeof window !== 'undefined' ? localStorage.getItem('railtwin-rapidapi-host') || 'irctc1.p.rapidapi.com' : 'irctc1.p.rapidapi.com',
  apiStatus: 'disconnected' as const,
  geminiApiKey: typeof window !== 'undefined' ? localStorage.getItem('railtwin-gemini-api-key') || '' : '',
  mobileLeftOpen: false,
  mobileRightOpen: false
};

export const useDemoStore = create<DemoState>((set, get) => ({
  ...initialStoreState,

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };
    set(state => ({ toasts: [...state.toasts, newToast] }));
  },

  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },

  setMobileLeftOpen: (open) => set({ mobileLeftOpen: open }),
  setMobileRightOpen: (open) => set({ mobileRightOpen: open }),

  toggleAudio: () => {
    set(state => ({ audioEnabled: !state.audioEnabled }));
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', nextTheme);
    }
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    set({ theme: nextTheme });
  },

  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    set({ theme });
  },

  setApiConfig: (config) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('railtwin-api-enabled', String(config.enabled));
      localStorage.setItem('railtwin-rapidapi-key', config.key);
      localStorage.setItem('railtwin-rapidapi-host', config.host);
    }
    set({
      liveApiEnabled: config.enabled,
      rapidApiKey: config.key,
      rapidApiHost: config.host,
      apiStatus: config.enabled ? (config.key ? 'connecting' : 'disconnected') : 'disconnected'
    });

    if (config.enabled && config.key) {
      get().addToast({
        type: 'info',
        title: 'Live Tracking Enabled',
        message: 'Connecting to Indian Railways feeds...'
      });
      // Fetch status immediately — status will update to 'connected' on success
      get().updateLiveTrainsFromApi();
    } else {
      get().addToast({
        type: 'info',
        title: 'Simulation Active',
        message: 'Running Delhi–Howrah high-fidelity simulator'
      });
    }
  },

  setGeminiApiKey: (key) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('railtwin-gemini-api-key', key);
    }
    set({ geminiApiKey: key });
  },

  updateLiveTrainsFromApi: async () => {
    const { liveApiEnabled, rapidApiKey, rapidApiHost, trains } = get();
    if (!liveApiEnabled || !rapidApiKey) return;

    // Guard against concurrent calls
    if (liveApiUpdating) return;
    liveApiUpdating = true;

    try {
      const updatedTrains = [...trains];
      let hasChange = false;

      // Update each train in parallel
      const updatePromises = trains.map(async (train) => {
        try {
          const apiData = await fetchLiveTrainStatus(train.id, rapidApiKey, rapidApiHost);
          const normalized = normalizeLiveTrainData(train.id, apiData, train);
          
          // Interpolate new coordinate if position/progress changes
          if (normalized.currentStation || normalized.routeProgress !== undefined) {
            const merged = { ...train, ...normalized } as Train;
            normalized.coordinates = interpolateTrainPosition(merged);
          }

          return { id: train.id, normalized };
        } catch (e) {
          console.error(`Failed live update for train ${train.id}`, e);
          return null;
        }
      });

      const results = await Promise.all(updatePromises);
      results.forEach(res => {
        if (res) {
          const idx = updatedTrains.findIndex(t => t.id === res.id);
          if (idx !== -1) {
            updatedTrains[idx] = { ...updatedTrains[idx], ...res.normalized };
            hasChange = true;
          }
        }
      });

      if (hasChange) {
        set({ trains: updatedTrains, apiStatus: 'connected' });
      }
    } catch (e) {
      console.error('Failed to update live trains from API', e);
      set({ apiStatus: 'error' });
    } finally {
      liveApiUpdating = false;
    }
  },

  pauseDemo: () => {
    set({ isPaused: true });
  },

  resumeDemo: () => {
    set({ isPaused: false });
  },

  seekTo: (time: number) => {
    const clampedTime = Math.max(0, Math.min(time, 50));
    set({ demoTime: clampedTime });
    // Process the event at this time
    const event = DEMO_TIMELINE.find(e => e.time === clampedTime);
    if (event) {
      get().tickDemo(clampedTime);
    }
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  startDemo: () => {
    if (timerInterval) clearInterval(timerInterval);
    eventTimeouts.forEach(clearTimeout);
    eventTimeouts = [];

    const current = get();
    set({
      ...initialStoreState,
      stations: current.stations,
      trains: JSON.parse(JSON.stringify(current.trains)),
      stationRisks: createInitialStationRisks(current.stations),
      demoRunning: true,
      isPaused: false,
      activePanel: 'map',
      // Preserve live API config from current state
      liveApiEnabled: current.liveApiEnabled,
      rapidApiKey: current.rapidApiKey,
      rapidApiHost: current.rapidApiHost,
      apiStatus: current.apiStatus,
      geminiApiKey: current.geminiApiKey
    });

    DEMO_TIMELINE.forEach(event => {
      const timeout = setTimeout(() => {
        if (get().demoRunning && !get().isPaused) {
          get().tickDemo(event.time);
        }
      }, event.time * 1000 / get().playbackSpeed);
      eventTimeouts.push(timeout);
    });

    timerInterval = setInterval(() => {
      const state = get();
      if (state.demoRunning && !state.isPaused) {
        const nextTime = state.demoTime + 1;

        // Advance train positions
        const updatedTrains = state.trains.map(train => {
          const distance = getCorridorDistance(train.currentStation, train.nextStation, state.stations);
          const speedKmPerSec = train.speed / 3600;
          const progressIncrement = distance > 0 ? (speedKmPerSec / distance) : 0;
          const newProgress = Math.min(train.routeProgress + progressIncrement, 1);
          const newCoords = interpolateTrainPosition({ ...train, routeProgress: newProgress }, state.stations);
          return { ...train, routeProgress: newProgress, coordinates: newCoords };
        });

        set({ demoTime: nextTime, trains: updatedTrains });

        // Update network health
        const currentState = get();
        const health = computeNetworkHealth(
          currentState.trains,
          currentState.stationRisks,
          currentState.simulation,
          currentState.weatherAlert
        );
        set({ networkHealth: health });

        // Automated Panel Switches & States
        if (nextTime === 8) {
          set({ activePanel: 'delays' });
        } else if (nextTime === 12) {
          set({ activePanel: 'simulation' });
        } else if (nextTime === 18) {
          set(s => ({
            activePanel: 'simulation',
            copilot: { ...s.copilot, thinking: true }
          }));
        } else if (nextTime === 24) {
          set({ activePanel: 'copilot' });
        } else if (nextTime === 30) {
          set({ activePanel: 'simulation' });
        } else if (nextTime === 50) {
          set({ activePanel: 'map', demoRunning: false });
          if (timerInterval) clearInterval(timerInterval);
        }

        // Audio alert for critical events
        if (currentState.audioEnabled && (nextTime === 0 || nextTime === 12 || nextTime === 42)) {
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.value = 0.1;
            osc.frequency.value = nextTime === 42 ? 880 : 440;
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
          } catch (e) { /* Audio not available */ }
        }
      }
    }, 1000);
  },

  resetDemo: () => {
    if (timerInterval) clearInterval(timerInterval);
    eventTimeouts.forEach(clearTimeout);
    eventTimeouts = [];
    const current = get();
    set({
      ...initialStoreState,
      stations: current.stations,
      trains: JSON.parse(JSON.stringify(current.trains)),
      stationRisks: createInitialStationRisks(current.stations),
      theme: get().theme,
      liveApiEnabled: get().liveApiEnabled,
      rapidApiKey: get().rapidApiKey,
      rapidApiHost: get().rapidApiHost,
      apiStatus: get().apiStatus,
      geminiApiKey: get().geminiApiKey
    });
  },

  setActivePanel: (panel) => {
    set({ activePanel: panel, mobileLeftOpen: false, mobileRightOpen: false });
  },

  setWhatIfStation: (station) => {
    set({ whatIfStation: station, whatIfResult: null });
  },

  setWhatIfScenario: (scenario) => {
    set({ whatIfScenario: scenario, whatIfResult: null });
  },

  runWhatIf: async () => {
    const state = get();
    const stationId = state.whatIfStation;
    const scenario = state.whatIfScenario;
    const station = state.stations.find(s => s.id === stationId);
    if (!station) return;

    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const response = await fetch(`${normalizedBase}api/trains/simulation/cascade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId, scenario })
      });

      if (!response.ok) throw new Error("Cascade simulation failed");
      const resultData = await response.json();

      // Find trains that pass through or near this station
      const affectedTrains = state.trains.filter(t =>
        t.currentStation === stationId || t.nextStation === stationId
      ).map(t => t.id);

      // Also affect trains downstream
      const sortedStations = [...state.stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);
      const stationIdx = sortedStations.findIndex(s => s.id === stationId);
      const downstreamIds = sortedStations.slice(stationIdx + 1).map(s => s.id);
      const downstreamTrains = state.trains.filter(t =>
        downstreamIds.includes(t.nextStation) && !affectedTrains.includes(t.id)
      ).map(t => t.id);

      const allAffected = [...affectedTrains, ...downstreamTrains];

      // Compute risk levels for affected stations
      const riskLevels: Record<string, { crowdRisk: string; delayRisk: string }> = {};
      const impactedStationIds = [stationId, ...downstreamIds];
      impactedStationIds.forEach(id => {
        const isSource = id === stationId;
        riskLevels[id] = {
          crowdRisk: isSource ? 'critical' : downstreamIds.indexOf(id) < 2 ? 'high' : 'moderate',
          delayRisk: isSource ? 'critical' : 'high'
        };
      });

      const result: WhatIfResult = {
        station: stationId,
        scenario,
        affectedTrains: allAffected,
        cascadeDelay: resultData.cascadeDelay,
        passengersAtRisk: resultData.passengersAffected,
        conflictsGenerated: resultData.conflictsDetected,
        riskLevels
      };

      set({ whatIfResult: result });

      get().addToast({
        type: 'info',
        title: 'What-If Analysis Complete',
        message: `${scenario.replace('_', ' ')} at ${station.name}: ${resultData.cascadeDelay}min cascade, ${allAffected.length} trains affected`
      });
    } catch (e) {
      console.error(e);
      get().addToast({
        type: 'error',
        title: 'Simulation Error',
        message: 'Could not communicate with the cascade simulation server.'
      });
    }
  },

  acceptRecommendation: (id) => {
    const updatedRecommendations = get().copilot.recommendations.map(r =>
      r.id === id ? { ...r, accepted: true } : r
    );

    set(state => ({
      copilot: {
        ...state.copilot,
        recommendations: updatedRecommendations,
        messages: [
          ...state.copilot.messages,
          {
            id: `user-msg-${Date.now()}`,
            sender: 'user',
            message: `Accepted recommendation: ${state.copilot.recommendations.find(r => r.id === id)?.action}`,
            timestamp: new Date()
          },
          {
            id: `copilot-apply-${Date.now()}`,
            sender: 'copilot',
            message: 'Sending hold instruction to Allahabad Junction (ALD). Recalculating signal schedules...',
            timestamp: new Date()
          }
        ]
      },
      intervention: {
        accepted: id,
        operator: 'OP-01'
      }
    }));

    const timeout = setTimeout(() => {
      if (!get().demoRunning) return;
      if (get().resolved) return;

      const state = get();
      const resolvedTrains = state.trains.map(t => {
        if (t.id === '12303') {
          return {
            ...t,
            currentStation: 'ald',
            predictedDelay: 18,
            routeProgress: 0.5,
            coordinates: interpolateTrainPosition({ ...t, currentStation: 'ald', nextStation: 'bsb', routeProgress: 0.5 }, state.stations)
          };
        }
        if (t.id === '12301') {
          return { ...t, predictedDelay: 19 };
        }
        return t;
      });

      get().addToast({
        type: 'success',
        title: 'Mitigation Successful',
        message: 'Intervention applied. 33 minutes saved.'
      });

      set(state => ({
        stationRisks: {
          ...state.stationRisks,
          pnbe: { crowdRisk: 'moderate', delayRisk: 'moderate', platformConflicts: 0 }
        },
        trains: resolvedTrains,
        simulation: state.simulation
          ? { ...state.simulation, cascadeDelay: 19, conflictsDetected: 0 }
          : null,
        resolved: {
          newCascadeDelay: 19,
          conflictsResolved: 3,
          riskReduction: 'CRITICAL→MODERATE',
          minutesSaved: 33
        },
        copilot: {
          ...state.copilot,
          messages: [
            ...state.copilot.messages,
            {
              id: `copilot-res-${Date.now()}`,
              sender: 'copilot',
              message: 'Intervention successful: Poorva Express hold processed. Grid conflicts resolved. Cascade delay minimized to 19 minutes.',
              timestamp: new Date()
            }
          ]
        }
      }));
    }, 1500);
    eventTimeouts.push(timeout);
  },

  tickDemo: async (second) => {
    const event = DEMO_TIMELINE.find(e => e.time === second);
    if (!event) return;

    const { type, payload } = event;

    switch (type) {
      case 'weather':
        get().addToast({
          type: 'warning',
          title: 'Disruption Detected',
          message: 'Heavy rainfall detected near Patna'
        });

        set(state => ({
          weatherAlert: payload,
          stationRisks: {
            ...state.stationRisks,
            [payload.station]: { crowdRisk: 'moderate', delayRisk: 'moderate', platformConflicts: 0 }
          },
          copilot: {
            ...state.copilot,
            messages: [
              ...state.copilot.messages,
              {
                id: `weather-msg-${Date.now()}`,
                sender: 'system',
                message: `Alert: Rainfall at ${payload.station.toUpperCase()} is ${payload.rainfall}mm/hr. Tracking localized delays.`,
                timestamp: new Date()
              }
            ]
          }
        }));
        break;

      case 'prediction': {
        const trainId = payload.trainId;
        const affectedStation = payload.affectedStation;

        // Get train's route to calculate route length
        const route = await railwayDataset.getRouteByTrainNo(trainId);
        let routeLengthKm = 1531; // fallback
        if (route) {
          let length = 0;
          for (let i = 0; i < route.route.length - 1; i++) {
            const fromId = nameToId(route.route[i]);
            const toId = nameToId(route.route[i+1]);
            length += getCorridorDistance(fromId, toId, get().stations);
          }
          routeLengthKm = length || 1531;
        }

        // Get station congestion level from current risks state
        const congestion = get().stationRisks[affectedStation]?.crowdRisk || 'low';

        // Check if there is an active weather alert for this station
        const weatherAlert = get().weatherAlert;
        const isAlertActive = weatherAlert && weatherAlert.station === affectedStation;
        const weatherCondition = isAlertActive
          ? (weatherAlert.rainfall > 50 ? 'Heavy Rain' : 'Rain')
          : 'Clear';
        const rainfall = isAlertActive ? weatherAlert.rainfall : undefined;

        // Run prediction dynamically using the engine
        const pred = await HistoricalDelayPredictionEngine.predict({
          trainNo: trainId,
          routeLengthKm,
          stationCongestion: congestion,
          weatherCondition,
          rainfallMmHr: rainfall
        });

        set(state => {
          const updatedTrains = state.trains.map(t =>
            t.id === trainId ? { ...t, predictedDelay: pred.predictedDelay } : t
          );
          const currentRisk = state.stationRisks[affectedStation];

          get().addToast({
            type: 'warning',
            title: 'Delay Accumulation',
            message: `${trainId}: +${pred.predictedDelay} min predicted delay (Dynamic)`
          });

          return {
            trains: updatedTrains,
            predictions: [
              ...state.predictions,
              {
                trainId,
                delayMinutes: pred.predictedDelay,
                affectedStation,
                confidence: pred.confidence,
                timestamp: second,
                explanation: pred.explanation
              }
            ],
            stationRisks: {
              ...state.stationRisks,
              [affectedStation]: { ...currentRisk, delayRisk: pred.predictedDelay > 30 ? 'high' : 'moderate' }
            },
            copilot: {
              ...state.copilot,
              messages: [
                ...state.copilot.messages,
                {
                  id: `pred-msg-${Date.now()}`,
                  sender: 'system',
                  message: `Predictive Alert: Train ${trainId} expected to accumulate ${pred.predictedDelay} min delay at ${affectedStation.toUpperCase()} (Confidence: ${Math.round(pred.confidence * 100)}%).`,
                  timestamp: new Date()
                }
              ]
            }
          };
        });
        break;
      }

      case 'simulation':
        get().addToast({
          type: 'error',
          title: 'Simulation Complete',
          message: 'Simulation complete: 3 platform conflicts, 19K passengers at risk'
        });

        set(state => ({
          simulation: {
            conflictsDetected: payload.conflictsDetected,
            cascadeDelay: payload.cascadeDelay,
            passengersAffected: payload.passengersAffected,
            stationsImpacted: payload.stationsImpacted,
            running: true
          }
        }));

        const simulationTimeout = setTimeout(() => {
          if (!get().demoRunning) return;
          set(state => ({
            simulation: state.simulation ? { ...state.simulation, running: false } : null,
            stationRisks: {
              ...state.stationRisks,
              pnbe: { crowdRisk: 'critical', delayRisk: 'critical', platformConflicts: 3 }
            },
            copilot: {
              ...state.copilot,
              messages: [
                ...state.copilot.messages,
                {
                  id: `sim-msg-${Date.now()}`,
                  sender: 'system',
                  message: `Simulation Complete: 3 conflicts detected at PNBE. Projected cascade delay is ${payload.cascadeDelay} mins.`,
                  timestamp: new Date()
                }
              ]
            }
          }));
        }, 500);
        eventTimeouts.push(simulationTimeout);
        break;

      case 'copilot':
        if (payload.thinking) {
          get().addToast({
            type: 'ai',
            title: 'Copilot Active',
            message: 'Copilot analyzing corridor impact...'
          });

          set(state => ({
            copilot: {
              ...state.copilot,
              thinking: true,
              messages: [
                ...state.copilot.messages,
                {
                  id: `cop-think-${Date.now()}`,
                  sender: 'copilot',
                  message: payload.message,
                  timestamp: new Date()
                }
              ]
            }
          }));
        } else {
          get().addToast({
            type: 'ai',
            title: 'Mitigations Available',
            message: '3 recommendations ready — review in Simulation panel'
          });

          set(state => ({
            copilot: {
              ...state.copilot,
              thinking: false,
              recommendations: payload.recommendations.map((rec: any) => ({ ...rec, accepted: false })),
              messages: [
                ...state.copilot.messages,
                {
                  id: `cop-rec-${Date.now()}`,
                  sender: 'copilot',
                  message: 'Analysis complete. Dispatching mitigation options. Operational hold at ALD recommended.',
                  timestamp: new Date()
                }
              ]
            }
          }));
        }
        break;

      case 'intervention':
        if (!get().intervention) {
          get().acceptRecommendation('rec-1');
        }
        break;

      case 'resolved':
        if (get().resolved) return;

        get().addToast({
          type: 'success',
          title: 'Disruption Resolved',
          message: 'Intervention applied. 33 minutes saved.'
        });

        const state = get();
        const resolvedTrains = state.trains.map(t => {
          if (t.id === '12303') {
            return {
              ...t,
              currentStation: 'ald',
              predictedDelay: 18,
              routeProgress: 0.5,
              coordinates: interpolateTrainPosition({ ...t, currentStation: 'ald', nextStation: 'bsb', routeProgress: 0.5 }, state.stations)
            };
          }
          if (t.id === '12301') {
            return { ...t, predictedDelay: 19 };
          }
          return t;
        });

        set(state => ({
          stationRisks: {
            ...state.stationRisks,
            pnbe: { crowdRisk: 'moderate', delayRisk: 'moderate', platformConflicts: 0 }
          },
          trains: resolvedTrains,
          simulation: state.simulation
            ? { ...state.simulation, cascadeDelay: payload.newCascadeDelay, conflictsDetected: 0 }
            : null,
          resolved: {
            newCascadeDelay: payload.newCascadeDelay,
            conflictsResolved: payload.conflictsResolved,
            riskReduction: payload.riskReduction,
            minutesSaved: payload.minutesSaved
          },
          copilot: {
            ...state.copilot,
            messages: [
              ...state.copilot.messages,
              {
                id: `cop-res-auto-${Date.now()}`,
                sender: 'copilot',
                message: `Conflict resolution auto-applied. New cascade delay is ${payload.newCascadeDelay} mins.`,
                timestamp: new Date()
              }
            ]
          }
        }));
        break;
    }
  }
}));

export const initDemoStore = () => {
  useDemoStore.getState().resetDemo();
};

// Fetch network data dynamically on initialization
export const fetchInitialData = async () => {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const stationsRes = await fetch(`${normalizedBase}api/trains/stations`);
    const trainsRes = await fetch(`${normalizedBase}api/trains`);
    if (stationsRes.ok && trainsRes.ok) {
      const stations = await stationsRes.json();
      const trains = await trainsRes.json();
      
      const risks: Record<string, StationRisk> = {};
      stations.forEach((station: any) => {
        risks[station.id] = {
          crowdRisk: 'low',
          delayRisk: 'low',
          platformConflicts: 0
        };
      });

      useDemoStore.setState({
        stations,
        trains,
        stationRisks: risks
      });

      // Update network health
      const state = useDemoStore.getState();
      const health = computeNetworkHealth(trains, risks, state.simulation, state.weatherAlert);
      useDemoStore.setState({ networkHealth: health });
    }
  } catch (err) {
    console.error("Failed to load network data dynamically, using fallback state:", err);
  }
};

if (typeof window !== 'undefined') {
  fetchInitialData();
}
