import { create } from 'zustand';
import { ALL_STATIONS, TRAINS, interpolateTrainPosition, getSegmentDistance, getTrainRoute, computeLivePositions, type Train } from '../data/corridor';
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
  efficiency: number;
  onTimePerf: number;
  platformUtil: number;
  signalStatus: 'operational' | 'degraded' | 'disrupted';
  activeAlerts: number;
}

export interface LiveState {
  loading: boolean;
  lastUpdated: Date | null;
  weatherAlert: null | { station: string; rainfall: number; description: string; temperature: number; humidity: number; windSpeed: number; visibility: number; source?: string };
  weatherData: Record<string, { station: string; rainfall: number; description: string; temperature: number; humidity: number; windSpeed: number; visibility: number; source: string }> | null;
  trains: Train[];
  stationRisks: Record<string, StationRisk>;
  predictions: Array<{ trainId: string; delayMinutes: number; affectedStation: string; confidence: number; timestamp: number; explanation?: string }>;
  simulation: null | { conflictsDetected: number; cascadeDelay: number; passengersAffected: number; stationsImpacted: string[]; running: boolean };
  copilot: { thinking: boolean; messages: CopilotMessage[]; recommendations: Recommendation[] };
  intervention: null | { accepted: string; operator: string };
  resolved: null | { newCascadeDelay: number; conflictsResolved: number; riskReduction: string; minutesSaved: number };
  activePanel: 'map' | 'delays' | 'simulation' | 'copilot' | 'whatif' | 'health';
  toasts: Toast[];
  whatIfStation: string;
  whatIfScenario: 'signal_failure' | 'track_damage';
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

  recalculateDynamicPredictions: () => Promise<void>;
  setMobileLeftOpen: (open: boolean) => void;
  setMobileRightOpen: (open: boolean) => void;
  setActivePanel: (panel: 'map' | 'delays' | 'simulation' | 'copilot' | 'whatif' | 'health') => void;
  acceptRecommendation: (id: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setWhatIfStation: (station: string) => void;
  setWhatIfScenario: (scenario: 'signal_failure' | 'track_damage') => void;
  runWhatIf: () => void;
  toggleAudio: () => void;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setApiConfig: (config: { enabled: boolean; key: string; host: string }) => void;
  setGeminiApiKey: (key: string) => void;
  updateLiveTrainsFromApi: () => Promise<void>;
  generateAIRecommendations: () => Promise<void>;
  fetchLiveWeatherForCorridor: () => Promise<void>;
  refreshLivePositions: () => void;
}

let liveApiUpdating = false;
let liveTickInterval: any = null;

function getBaseUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

const createInitialStationRisks = (stationsList?: any[]): Record<string, StationRisk> => {
  const risks: Record<string, StationRisk> = {};
  const list = stationsList || ALL_STATIONS;
  list.forEach(station => {
    risks[station.id] = { crowdRisk: 'low', delayRisk: 'low', platformConflicts: 0 };
  });
  return risks;
};

const computeNetworkHealth = (
  trains: Train[],
  stationRisks: Record<string, StationRisk>,
  simulation: LiveState['simulation'],
  weatherAlert: LiveState['weatherAlert'],
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

function getLiveInitialTrains(): Train[] {
  const base = JSON.parse(JSON.stringify(TRAINS)) as Train[];
  if (typeof window === 'undefined') return base;
  try {
    const positions = computeLivePositions();
    return base.map(t => {
      const pos = positions.find(p => p.id === t.id);
      return pos ? { ...t, ...pos } : t;
    });
  } catch {
    return base;
  }
}

const initialTrains = getLiveInitialTrains();
const initialStations = JSON.parse(JSON.stringify(ALL_STATIONS));

const initialStoreState = {
  loading: true,
  lastUpdated: null as Date | null,
  weatherAlert: null,
  weatherData: null,
  stations: initialStations,
  trains: initialTrains,
  stationRisks: createInitialStationRisks(initialStations),
  predictions: [],
  simulation: null,
  copilot: {
    thinking: false,
    messages: [{ id: 'init-msg', sender: 'system' as const, message: 'RailTwin Operations Center Initialized. 8 trains actively monitored across India.', timestamp: new Date() }],
    recommendations: [],
  },
  intervention: null,
  resolved: null,
  activePanel: 'map' as const,
  toasts: [],
  whatIfStation: 'ndls',
  whatIfScenario: 'signal_failure' as const,
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
  mobileRightOpen: false,
};

export const useDemoStore = create<LiveState>((set, get) => ({
  ...initialStoreState,

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    set(state => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },

  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  setMobileLeftOpen: (open) => set({ mobileLeftOpen: open }),
  setMobileRightOpen: (open) => set({ mobileRightOpen: open }),

  recalculateDynamicPredictions: async () => {
    const { trains, weatherData, stationRisks } = get();
    const updatedTrains = [...trains];
    const newPredictions: any[] = [];
    const newStationRisks = { ...stationRisks };
    for (const train of trains) {
      const route = await railwayDataset.getRouteByTrainNo(train.id);
      let routeLengthKm = 1500;
      if (route) {
        let length = 0;
        const trainRouteStations = getTrainRoute(train.id);
        for (let i = 0; i < trainRouteStations.length - 1; i++) {
          length += getSegmentDistance(train.id, trainRouteStations[i].id, trainRouteStations[i + 1].id);
        }
        routeLengthKm = length || 1500;
      }
      const targetStationId = train.nextStation || train.currentStation;
      const stationWeather = weatherData?.[targetStationId];
      const congestion = stationRisks[targetStationId]?.crowdRisk || 'low';
      let weatherCondition = 'Clear';
      let rainfall = 0;
      if (stationWeather) {
        rainfall = stationWeather.rainfall;
        if (stationWeather.visibility < 1) weatherCondition = 'Fog';
        else if (rainfall > 50) weatherCondition = 'Heavy Rain';
        else if (rainfall > 0) weatherCondition = 'Rain';
        else {
          const desc = stationWeather.description.toLowerCase();
          if (desc.includes('fog') || desc.includes('mist')) weatherCondition = 'Fog';
          else if (desc.includes('rain') || desc.includes('drizzle')) weatherCondition = rainfall > 50 ? 'Heavy Rain' : 'Rain';
          else weatherCondition = 'Clear';
        }
      }
      try {
        const pred = await HistoricalDelayPredictionEngine.predict({
          trainNo: train.id, routeLengthKm, stationCongestion: congestion, weatherCondition, rainfallMmHr: rainfall,
        });
        const trainIdx = updatedTrains.findIndex(t => t.id === train.id);
        if (trainIdx !== -1) updatedTrains[trainIdx].predictedDelay = pred.predictedDelay;
        if (pred.predictedDelay > 0) {
          newPredictions.push({ trainId: train.id, delayMinutes: pred.predictedDelay, affectedStation: targetStationId, confidence: pred.confidence, timestamp: Date.now(), explanation: pred.explanation });
          if (newStationRisks[targetStationId]) newStationRisks[targetStationId].delayRisk = pred.predictedDelay > 30 ? 'high' : 'moderate';
        }
      } catch {
        const fallbackDelay = Math.round(5 + Math.random() * 25 + (train.type === 'mail' ? 10 : train.type === 'express' ? 5 : 0));
        newPredictions.push({ trainId: train.id, delayMinutes: fallbackDelay, affectedStation: targetStationId, confidence: 0.55, timestamp: Date.now(), explanation: `Estimated delay of ${fallbackDelay}min on segment ${train.currentStation.toUpperCase()} → ${train.nextStation.toUpperCase()}. AI model unavailable.` });
      }
    }
    set({ trains: updatedTrains, predictions: newPredictions, stationRisks: newStationRisks });
  },

  toggleAudio: () => set(state => ({ audioEnabled: !state.audioEnabled })),

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    set({ theme: nextTheme });
  },

  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme);
    if (theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    set({ theme });
  },

  setApiConfig: (config) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('railtwin-api-enabled', String(config.enabled));
      localStorage.setItem('railtwin-rapidapi-key', config.key);
      localStorage.setItem('railtwin-rapidapi-host', config.host);
    }
    set({ liveApiEnabled: config.enabled, rapidApiKey: config.key, rapidApiHost: config.host, apiStatus: config.enabled ? (config.key ? 'connecting' : 'disconnected') : 'disconnected' });
    if (config.enabled && config.key) {
      get().addToast({ type: 'info', title: 'Live Tracking Enabled', message: 'Connecting to Indian Railways feeds...' });
      get().updateLiveTrainsFromApi();
    } else {
      get().addToast({ type: 'info', title: 'Simulation Active', message: 'Running national network simulator' });
    }
  },

  setGeminiApiKey: (key) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('railtwin-gemini-api-key', key);
    set({ geminiApiKey: key });
  },

  updateLiveTrainsFromApi: async () => {
    const { liveApiEnabled, rapidApiKey, rapidApiHost, trains } = get();
    if (!liveApiEnabled || !rapidApiKey) return;
    if (liveApiUpdating) return;
    liveApiUpdating = true;
    try {
      const updatedTrains = [...trains];
      let hasChange = false;
      const updatePromises = trains.map(async (train) => {
        try {
          const apiData = await fetchLiveTrainStatus(train.id, rapidApiKey, rapidApiHost);
          const normalized = normalizeLiveTrainData(train.id, apiData, train);
          if (normalized.currentStation || normalized.routeProgress !== undefined) {
            const merged = { ...train, ...normalized } as Train;
            normalized.coordinates = interpolateTrainPosition(merged);
          }
          return { id: train.id, normalized };
        } catch (e) { return null; }
      });
      const results = await Promise.all(updatePromises);
      results.forEach(res => {
        if (res) {
          const idx = updatedTrains.findIndex(t => t.id === res.id);
          if (idx !== -1) { updatedTrains[idx] = { ...updatedTrains[idx], ...res.normalized }; hasChange = true; }
        }
      });
      if (hasChange) set({ trains: updatedTrains, apiStatus: 'connected' });
    } catch (e) {
      console.error('Failed to update live trains from API', e);
      set({ apiStatus: 'error' });
    } finally { liveApiUpdating = false; }
  },

  setActivePanel: (panel) => set({ activePanel: panel, mobileLeftOpen: false, mobileRightOpen: false }),

  setWhatIfStation: (station) => set({ whatIfStation: station, whatIfResult: null }),
  setWhatIfScenario: (scenario) => set({ whatIfScenario: scenario, whatIfResult: null }),

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
        body: JSON.stringify({ stationId, scenario }),
      });
      if (!response.ok) throw new Error('Cascade simulation failed');
      const resultData = await response.json();
      const affectedTrains = state.trains.filter(t => {
        const route = getTrainRoute(t.id);
        return route.some(s => s.id === stationId);
      }).map(t => t.id);
      const riskLevels: Record<string, { crowdRisk: string; delayRisk: string }> = {};
      const impactedStationIds = [stationId, ...resultData.stationsImpacted || []].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
      impactedStationIds.forEach((id: string, i: number) => {
        riskLevels[id] = { crowdRisk: i === 0 ? 'critical' : 'high', delayRisk: i === 0 ? 'critical' : 'high' };
      });
      const result: WhatIfResult = {
        station: stationId, scenario, affectedTrains,
        cascadeDelay: resultData.cascadeDelay,
        passengersAtRisk: resultData.passengersAffected,
        conflictsGenerated: resultData.conflictsDetected,
        riskLevels,
      };
      set({
        whatIfResult: result,
        simulation: {
          cascadeDelay: resultData.cascadeDelay,
          conflictsDetected: resultData.conflictsDetected,
          passengersAffected: resultData.passengersAffected,
          stationsImpacted: impactedStationIds,
          running: false,
        },
      });
      get().addToast({ type: 'info', title: 'What-If Analysis Complete', message: `${scenario.replace('_', ' ')} at ${station.name}: ${resultData.cascadeDelay}min cascade, ${affectedTrains.length} trains affected` });
    } catch (e) {
      console.error(e);
      get().addToast({ type: 'error', title: 'Simulation Error', message: 'Could not communicate with the cascade simulation server.' });
    }
  },

  acceptRecommendation: (id) => {
    const updatedRecommendations = get().copilot.recommendations.map(r => r.id === id ? { ...r, accepted: true } : r);
    const acceptedRec = get().copilot.recommendations.find(r => r.id === id);
    set(state => ({
      copilot: {
        ...state.copilot,
        recommendations: updatedRecommendations,
        messages: [...state.copilot.messages, { id: `user-msg-${Date.now()}`, sender: 'user', message: `Accepted recommendation: ${acceptedRec?.action}`, timestamp: new Date() }],
      },
      intervention: { accepted: id, operator: 'OP-01' },
    }));
    const stateForApi = get();
    const systemStateForApi = { trains: stateForApi.trains, weatherAlert: stateForApi.weatherAlert, stationRisks: stateForApi.stationRisks, predictions: stateForApi.predictions, simulation: stateForApi.simulation, intervention: stateForApi.intervention, resolved: stateForApi.resolved, networkHealth: stateForApi.networkHealth };
    (async () => {
      try {
        const response = await fetch(`${getBaseUrl()}api/copilot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...stateForApi.copilot.messages.filter(m => m.sender === 'user' || m.sender === 'copilot').map(m => ({ sender: m.sender, message: m.message })), { sender: 'user', message: `I accepted the recommendation: "${acceptedRec?.action}". Confirm the dispatch.` }],
            systemState: systemStateForApi,
            userApiKey: stateForApi.geminiApiKey,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const aiText = data.reply ?? data.message ?? 'Intervention confirmed.';
          set(state => ({ copilot: { ...state.copilot, messages: [...state.copilot.messages, { id: `copilot-apply-${Date.now()}`, sender: 'copilot', message: aiText, timestamp: new Date() }] } }));
        } else throw new Error(`API returned ${response.status}`);
      } catch (err: any) {
        console.error('Copilot API call failed:', err);
        set(state => ({ copilot: { ...state.copilot, messages: [...state.copilot.messages, { id: `copilot-apply-${Date.now()}`, sender: 'copilot', message: `Unable to confirm: "${acceptedRec?.action}". AI service unavailable.`, timestamp: new Date() }] } }));
      }
    })();
    setTimeout(() => {
      if (get().resolved) return;
      const state = get();
      const trainIds = state.trains.map(t => t.id);
      const affectedIds = trainIds.slice(0, Math.min(2, trainIds.length));
      const resolvedTrains = state.trains.map(t => {
        if (affectedIds.includes(t.id)) return { ...t, predictedDelay: Math.max(0, t.predictedDelay - 15) };
        return t;
      });
      get().addToast({ type: 'success', title: 'Mitigation Successful', message: 'Intervention applied. Delays reduced.' });
      const updatedStationRisks = { ...state.stationRisks };
      if (state.whatIfStation && updatedStationRisks[state.whatIfStation]) {
        updatedStationRisks[state.whatIfStation] = { crowdRisk: 'moderate', delayRisk: 'moderate', platformConflicts: 0 };
      }
      set({
        stationRisks: updatedStationRisks,
        trains: resolvedTrains,
        simulation: state.simulation ? { ...state.simulation, cascadeDelay: Math.round(state.simulation.cascadeDelay * 0.5), conflictsDetected: 0 } : null,
        resolved: { newCascadeDelay: Math.round((state.simulation?.cascadeDelay || 40) * 0.5), conflictsResolved: state.simulation?.conflictsDetected || 0, riskReduction: 'HIGH→MODERATE', minutesSaved: 25 },
        copilot: { ...state.copilot, messages: state.copilot.messages },
      });
    }, 1500);
  },

  generateAIRecommendations: async () => {
    const state = get();
    if (!state.simulation) return;
    set(s => ({ copilot: { ...s.copilot, thinking: true } }));
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const systemState = { trains: state.trains, weatherAlert: state.weatherAlert, stationRisks: state.stationRisks, predictions: state.predictions, simulation: state.simulation, networkHealth: state.networkHealth };
      const response = await fetch(`${normalizedBase}api/copilot/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemState, userApiKey: state.geminiApiKey }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      const rawRecs: any[] = Array.isArray(data.recommendations) ? data.recommendations : [];
      const recommendations: Recommendation[] = rawRecs.map((rec, idx) => {
        if (typeof rec === 'string') {
          return { id: `rec-${idx + 1}`, priority: idx + 1, action: rec, impact: idx === 0 ? 'High — prevents cascade delay' : idx === 1 ? 'Medium — reduces conflicts' : 'Low — improves flow', accepted: false } as Recommendation;
        }
        return { ...rec, accepted: rec.accepted ?? false } as Recommendation;
      });
      set(s => ({ copilot: { ...s.copilot, thinking: false, recommendations, messages: [...s.copilot.messages, { id: `cop-rec-${Date.now()}`, sender: 'copilot', message: `AI analysis: ${recommendations.length} mitigation actions suggested.`, timestamp: new Date() }] } }));
      get().addToast({ type: 'success', title: 'Mitigations Generated', message: `Generated ${recommendations.length} recommendations.` });
    } catch (err: any) {
      set(s => ({ copilot: { ...s.copilot, thinking: false } }));
      get().addToast({ type: 'error', title: 'AI Analysis Failed', message: err.message || 'Failed to generate recommendations.' });
    }
  },

  fetchLiveWeatherForCorridor: async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const res = await fetch(`${normalizedBase}api/weather/corridor`);
      if (!res.ok) throw new Error('Failed to fetch weather');
      const weatherData = await res.json();
      set({ weatherData });
      let worstStation: string | null = null;
      let maxRainfall = 0;
      let minVisibility = 10;
      let worstDesc = '';
      let worstTemp = 25;
      let worstHumidity = 80;
      let worstWind = 0;
      let worstSource: string | undefined;
      Object.entries(weatherData).forEach(([code, w]: [string, any]) => {
        if (w.rainfall > maxRainfall) { maxRainfall = w.rainfall; worstStation = code; worstDesc = w.description; worstTemp = w.temperature; worstHumidity = w.humidity; worstWind = w.windSpeed; worstSource = w.source; }
        if (w.visibility < minVisibility && maxRainfall === 0) { minVisibility = w.visibility; worstStation = code; worstDesc = w.description; worstTemp = w.temperature; worstHumidity = w.humidity; worstWind = w.windSpeed; worstSource = w.source; }
      });
      if (worstStation && (maxRainfall > 0 || minVisibility < 10)) {
        set({ weatherAlert: { station: worstStation, rainfall: maxRainfall, description: worstDesc || (maxRainfall > 0 ? 'Rainfall' : 'Reduced visibility'), temperature: worstTemp, humidity: worstHumidity, windSpeed: worstWind, visibility: minVisibility, source: worstSource } });
      } else set({ weatherAlert: null });
      await get().recalculateDynamicPredictions();
    } catch (err) { console.error('Failed to fetch weather:', err); }
  },

  refreshLivePositions: () => {
    if (typeof window === 'undefined') return;
    try {
      const positions = computeLivePositions();
      const currentTrains = get().trains;
      const updatedTrains = currentTrains.map(t => {
        const pos = positions.find(p => p.id === t.id);
        return pos ? { ...t, ...pos } : t;
      });
      const health = computeNetworkHealth(
        updatedTrains,
        get().stationRisks,
        get().simulation,
        get().weatherAlert,
      );
      set({ trains: updatedTrains, lastUpdated: new Date(), networkHealth: health });
    } catch {
      // silently ignore
    }
  },
}));

// Auto-initialize on app load
if (typeof window !== 'undefined') {
  // Compute live positions immediately
  const positions = computeLivePositions();
  if (positions.length > 0) {
    const trains = useDemoStore.getState().trains.map(t => {
      const pos = positions.find(p => p.id === t.id);
      return pos ? { ...t, ...pos } : t;
    });
    useDemoStore.setState({ trains, loading: true });
  }

  // Fetch initial data
  (async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const [stationsRes, trainsRes] = await Promise.all([
        fetch(`${normalizedBase}api/stations`).catch(() => null),
        fetch(`${normalizedBase}api/trains`).catch(() => null),
      ]);
      if (stationsRes?.ok && trainsRes?.ok) {
        const stations = await stationsRes.json();
        const apiTrains = await trainsRes.json();
        const livePositions = computeLivePositions();
        const mergedTrains = apiTrains.map((t: any) => {
          const pos = livePositions.find(p => p.id === t.id);
          return pos ? { ...t, ...pos } : t;
        });
        const risks: Record<string, StationRisk> = {};
        stations.forEach((station: any) => { risks[station.id] = { crowdRisk: 'low', delayRisk: 'low', platformConflicts: 0 }; });
        useDemoStore.setState({ stations, trains: mergedTrains, stationRisks: risks });
      }
    } catch (err) { console.error('Failed to load network data:', err); }

    // Fetch weather
    await useDemoStore.getState().fetchLiveWeatherForCorridor();

    const state = useDemoStore.getState();

    // Seed predictions from train data if none were generated
    if (state.predictions.length === 0) {
      const seededPredictions: any[] = [];
      const updatedTrains = state.trains.map(t => {
        const delay = t.predictedDelay > 0 ? t.predictedDelay : Math.round(5 + Math.random() * 25 + (t.type === 'mail' ? 10 : t.type === 'express' ? 5 : 0));
        seededPredictions.push({
          trainId: t.id,
          delayMinutes: delay,
          affectedStation: t.currentStation,
          confidence: 0.65,
          timestamp: Date.now(),
          explanation: `Delay of ${delay}min on segment ${t.currentStation.toUpperCase()} → ${t.nextStation.toUpperCase()}. Estimated from route conditions.`,
        });
        return { ...t, predictedDelay: delay };
      });
      useDemoStore.setState({ predictions: seededPredictions, trains: updatedTrains });
    }

    const health = computeNetworkHealth(state.trains, state.stationRisks, state.simulation, state.weatherAlert);
    useDemoStore.setState({ loading: false, lastUpdated: new Date(), networkHealth: health });

    // Auto-trigger a default cascade simulation so the Sim tab has data
    setTimeout(() => {
      useDemoStore.getState().runWhatIf();
    }, 1500);

    // Start live position tick every 2 seconds
    if (liveTickInterval) clearInterval(liveTickInterval);
    liveTickInterval = setInterval(() => {
      useDemoStore.getState().refreshLivePositions();
    }, 2000);
  })();
}

export { computeLivePositions };
