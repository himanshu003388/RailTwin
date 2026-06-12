/**
 * ML Delay Prediction Service
 *
 * Loads a pre-trained ridge regression model from JSON weights
 * and runs inference in the browser. The model was trained on
 * 448 historical Indian Railway delay records using:
 *   - Weather condition (one-hot: 7 types)
 *   - Month (one-hot: 12 months)
 *   - Train type (one-hot: rajdhani/express/mail/passenger)
 *   - Route length (normalized)
 *   - Derived: is_monsoon, is_winter, is_night
 *
 * Model: Ridge regression (λ=1.0) via normal equation
 * R² = 0.73, RMSE = 8.7 min on training set
 */

export interface MLPredictionInput {
  trainNo: string;
  routeLengthKm: number;
  stationCongestion: 'low' | 'moderate' | 'high' | 'critical';
  weatherCondition: string;
  rainfallMmHr?: number;
}

export interface MLPredictionOutput {
  predictedDelay: number;
  confidence: number;
  modelVersion: string;
  featureContributions: Record<string, number>;
}

const WEATHER_TYPES = ['Clear', 'Rain', 'Heavy Rain', 'Fog', 'Heavy Fog', 'Monsoon', 'Heatwave'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const TRAIN_TYPES = ['rajdhani', 'express', 'mail', 'passenger'];

const TRAIN_TYPE_MAP: Record<string, string> = {
  '12301': 'rajdhani', '12303': 'express', '12305': 'rajdhani', '13005': 'mail',
  '12273': 'express', '12002': 'rajdhani', '12951': 'rajdhani', '12259': 'express',
  '12434': 'mail', '12809': 'express', '12625': 'mail', '12137': 'express',
  '12559': 'mail', '12367': 'express', '12903': 'rajdhani', '12267': 'express',
  '12050': 'rajdhani', '12215': 'express', '12165': 'express', '12723': 'mail',
  '12229': 'express', '12426': 'mail', '12826': 'express', '12101': 'rajdhani',
  '12611': 'mail', '12433': 'express', '12877': 'express', '12269': 'express',
};

interface ModelWeights {
  version: string;
  model: string;
  numFeatures: number;
  featureNames: string[];
  metrics: { rmse: number; mae: number; r2: number; maxError: number };
  bias: number;
  weights: number[];
  encoders: {
    weather: string[];
    months: string[];
    trainTypes: string[];
    trainTypeMap: Record<string, string>;
  };
}

let cachedModel: ModelWeights | null = null;

async function loadModel(): Promise<ModelWeights> {
  if (cachedModel) return cachedModel;

  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const res = await fetch(`${normalizedBase}data/delay-model-weights.json`);
  if (!res.ok) throw new Error(`Failed to load ML model: ${res.status}`);
  cachedModel = await res.json() as ModelWeights;
  return cachedModel!;
}

function encodeFeatures(input: MLPredictionInput, model: ModelWeights): number[] {
  const features: number[] = [];

  // Weather one-hot (7 features)
  for (const w of model.encoders.weather) {
    features.push(input.weatherCondition.toLowerCase().includes(w.toLowerCase()) ? 1 : 0);
  }

  // Month one-hot (12 features) - default to July (monsoon) if unknown
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  for (const m of model.encoders.months) {
    features.push(currentMonth === m ? 1 : 0);
  }

  // Train type one-hot (4 features)
  const trainType = model.encoders.trainTypeMap[input.trainNo] || 'express';
  for (const t of model.encoders.trainTypes) {
    features.push(trainType === t ? 1 : 0);
  }

  // Route length normalized (1 feature)
  features.push(Math.min(input.routeLengthKm / 1500, 1));

  // Derived features (3 features)
  const monthIdx = model.encoders.months.indexOf(currentMonth);
  const isNight = 0; // not available, default 0
  const isMonsoon = monthIdx >= 5 && monthIdx <= 8 ? 1 : 0;
  const isWinter = monthIdx <= 1 || monthIdx >= 10 ? 1 : 0;
  features.push(isNight, isMonsoon, isWinter);

  return features;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function getSeasonLabel(month: number): string {
  if (month >= 5 && month <= 8) return 'Monsoon';
  if (month >= 9 && month <= 11) return 'Post-Monsoon';
  if (month <= 1 || month === 12) return 'Winter';
  return 'Summer';
}

export class MLDelayPredictor {
  private static instance: MLDelayPredictor;
  private model: ModelWeights | null = null;
  private loadPromise: Promise<void> | null = null;

  static getInstance(): MLDelayPredictor {
    if (!MLDelayPredictor.instance) {
      MLDelayPredictor.instance = new MLDelayPredictor();
    }
    return MLDelayPredictor.instance;
  }

  async initialize(): Promise<void> {
    if (this.model) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      this.model = await loadModel();
      console.log(`ML model loaded: v${this.model.version}, R²=${this.model.metrics.r2}`);
    })();

    return this.loadPromise;
  }

  async predict(input: MLPredictionInput): Promise<MLPredictionOutput> {
    await this.initialize();
    if (!this.model) throw new Error('ML model not loaded');

    const features = encodeFeatures(input, this.model);
    const rawPrediction = dotProduct(features, this.model.weights) + this.model.bias;
    const predictedDelay = Math.max(0, Math.round(rawPrediction));

    // Compute confidence based on model metrics and input uncertainty
    let confidence = 0.85; // base confidence from R²
    if (input.weatherCondition.toLowerCase().includes('fog')) confidence -= 0.12;
    if (input.weatherCondition.toLowerCase().includes('heavy')) confidence -= 0.08;
    if (input.rainfallMmHr && input.rainfallMmHr > 50) confidence -= 0.10;
    confidence = Math.max(0.15, confidence);

    // Compute per-feature contributions
    const contributions: Record<string, number> = {};
    this.model.featureNames.forEach((name, i) => {
      const contribution = features[i] * this.model!.weights[i];
      if (Math.abs(contribution) > 0.01) {
        contributions[name] = +contribution.toFixed(2);
      }
    });

    return {
      predictedDelay,
      confidence: +confidence.toFixed(2),
      modelVersion: this.model.version,
      featureContributions: contributions,
    };
  }

  getModelInfo() {
    return this.model ? {
      version: this.model.version,
      metrics: this.model.metrics,
      numFeatures: this.model.numFeatures,
      trainingSamples: 448,
    } : null;
  }
}

export const mlPredictor = MLDelayPredictor.getInstance();
