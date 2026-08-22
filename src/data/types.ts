export interface TrainRoute {
  trainNo: string;
  trainName: string;
  route: string[];
}

export interface StationData {
  code: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
}

export interface HistoricalDelay {
  trainNo: string;
  month: string;
  weather: string;
  avgDelay: number;
}

// ─────────────────────────────────────────────────────────────
// Round 2 · Reconciliation: Drift Indicator
// ─────────────────────────────────────────────────────────────

export type DriftClass = 'stable' | 'minor' | 'significant' | 'critical';

export interface WeatherSnapshot {
  rainfall: number;
  description: string;
  temperature: number;
  visibility: number;
  source: string;
}

/** Per-train state frozen inside a baseline ("recorded context"). */
export interface BaselineTrainSnapshot {
  trainId: string;
  trainName: string;
  currentStation: string;
  nextStation: string;
  routeProgress: number;
  coordinates: [number, number];
  speed: number;
  passengerCount: number;
  predictedDelay: number;
  confidence: number;
  /** Weather class the prediction was made under (assumption tracking). */
  weatherConditionAtNext: string;
  /**
   * When this per-train snapshot was (re-)anchored. Normally equals the
   * baseline capture time; updated when an operator accepts live reality
   * for this train, so position projection restarts from that moment.
   */
  snapshotAt?: string;
}

/** The originally recorded context an operator shift is acting on. */
export interface BaselineSnapshot {
  id: string;
  name: string;
  capturedAt: string; // ISO timestamp
  source: 'auto' | 'manual' | 'replay';
  trains: BaselineTrainSnapshot[];
  weather: Record<string, WeatherSnapshot>;
}

/** Live network state in the same shape as a baseline, for diffing. */
export interface LiveSnapshot {
  at: string;
  trains: BaselineTrainSnapshot[];
  weather: Record<string, WeatherSnapshot>;
}

export interface DriftComponent {
  key: 'schedule' | 'position' | 'prediction' | 'weather';
  label: string;
  raw: number;
  unit: string;
  normalized: number; // 0-100
  weight: number;     // fraction of total score
  weighted: number;   // normalized × weight
  detail: string;
}

export interface TrainDrift {
  trainId: string;
  trainName: string;
  score: number; // 0-100
  driftClass: DriftClass;
  components: DriftComponent[];
  baseline: { station: string; nextStation: string; progress: number; delay: number; coordinates: [number, number] };
  live: { station: string; nextStation: string; progress: number; delay: number; coordinates: [number, number] };
  /** Where the baseline context implied the train would be right now. */
  expected: { coordinates: [number, number]; kmAlongRoute: number };
  explanation: string;
}

export interface DriftReport {
  baselineId: string;
  baselineName: string;
  capturedAt: string;
  computedAt: string;
  elapsedMinutes: number;
  corridorScore: number;
  corridorClass: DriftClass;
  trains: TrainDrift[];
}

export type ReconType = 'conflict' | 'duplicate' | 'partial-match';
export type ReconResolution = 'accept-live' | 'keep-baseline' | 'merge';

export interface ReconSource {
  name: string;       // e.g. "OpenWeatherMap", "SSE feed", "Position engine"
  value: string;      // human-readable claim
  timestamp?: string;
  confidence?: number; // 0-1
}

export interface ReconciliationItem {
  id: string;
  type: ReconType;
  entity: string;       // train id or station id
  entityLabel: string;  // display name
  field: string;        // what is disputed, e.g. "position", "weather", "station name"
  sourceA: ReconSource;
  sourceB: ReconSource;
  similarity?: number;  // 0-1, for partial matches
  severity: 'low' | 'moderate' | 'high' | 'critical';
  suggestedResolution: ReconResolution;
  suggestion: string;
  detectedAt: string;
  status: 'open' | 'resolved';
  resolution?: ReconResolution;
  resolvedAt?: string;
}

export interface DriftTimelineEvent {
  at: string;
  kind: 'baseline' | 'drift' | 'conflict' | 'duplicate' | 'partial-match' | 'resolution' | 'replay';
  message: string;
}
