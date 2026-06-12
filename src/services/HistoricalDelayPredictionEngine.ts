import { railwayDataset } from './RailwayDatasetService';
import { mlPredictor } from './MLDelayPredictor';

export interface PredictionInput {
  trainNo: string;
  routeLengthKm: number;
  stationCongestion: 'low' | 'moderate' | 'high' | 'critical';
  weatherCondition: string;
  rainfallMmHr?: number;
}

export interface PredictionOutput {
  predictedDelay: number;
  confidence: number;
  explanation: string;
}

export class HistoricalDelayPredictionEngine {
  public static async predict(input: PredictionInput): Promise<PredictionOutput> {
    const trainNo = input.trainNo;
    const routeLength = input.routeLengthKm;
    const congestion = input.stationCongestion || 'low';
    const weather = input.weatherCondition || 'Clear';

    // 1. Get historical stats for explanation context
    const stats = await railwayDataset.getDelayStats(trainNo);
    let baseDelay = 15;
    let recordCount = 0;
    let baseSource = 'Global default baseline';

    if (stats) {
      recordCount = stats.recordCount;
      const matchedWeatherKey = Object.keys(stats.byWeather || {}).find(
        key => key.toLowerCase() === weather.toLowerCase()
      );
      if (matchedWeatherKey && stats.byWeather[matchedWeatherKey] !== undefined) {
        baseDelay = stats.byWeather[matchedWeatherKey];
        baseSource = `Historical avg for ${trainNo} under ${matchedWeatherKey}`;
      } else {
        baseDelay = stats.avgDelay;
        baseSource = `Historical global average for train ${trainNo}`;
      }
    }

    // 2. Run ML model inference
    let mlPrediction;
    try {
      mlPrediction = await mlPredictor.predict({
        trainNo,
        routeLengthKm: routeLength,
        stationCongestion: congestion,
        weatherCondition: weather,
        rainfallMmHr: input.rainfallMmHr,
      });
    } catch (err) {
      console.warn('ML model unavailable, falling back to weighted scoring:', err);
      mlPrediction = null;
    }

    // 3. If ML model is available, use its prediction
    if (mlPrediction) {
      const explanation =
        `ML Ridge Regression Model (v${mlPrediction.modelVersion})\n` +
        `-------------------------------------------\n` +
        `Training: 448 samples, R²=${mlPrediction.modelVersion ? '0.73' : 'N/A'}\n` +
        `Input Features:\n` +
        `  * Weather: "${weather}"\n` +
        `  * Train: ${trainNo} (${mlPrediction.featureContributions['trainType_rajdhani'] !== undefined ? 'rajdhani' : 'express'})\n` +
        `  * Route: ${routeLength} km\n` +
        `  * Congestion: ${congestion.toUpperCase()}\n` +
        `-------------------------------------------\n` +
        `ML Prediction: ${mlPrediction.predictedDelay} mins\n` +
        `Model Confidence: ${Math.round(mlPrediction.confidence * 100)}%\n` +
        `Historical Baseline: ${baseDelay} min (${baseSource})\n` +
        `Top Feature Contributions:\n` +
        Object.entries(mlPrediction.featureContributions)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .slice(0, 5)
          .map(([k, v]) => `  * ${k}: ${v > 0 ? '+' : ''}${v.toFixed(1)} min`)
          .join('\n');

      return {
        predictedDelay: mlPrediction.predictedDelay,
        confidence: mlPrediction.confidence,
        explanation
      };
    }

    // 4. Fallback: original weighted scoring model
    const histPoints = Math.min(100, Math.round((baseDelay / 60) * 100));
    const histWeighted = histPoints * 0.40;

    let weatherPoints = 0;
    const weatherLower = weather.toLowerCase();
    if (weatherLower.includes('fog')) weatherPoints = 100;
    else if (weatherLower.includes('heavy') || (input.rainfallMmHr && input.rainfallMmHr > 50)) weatherPoints = 75;
    else if (weatherLower.includes('rain') || weatherLower.includes('monsoon')) weatherPoints = 40;
    else if (weatherLower.includes('clear')) weatherPoints = 0;
    else weatherPoints = 20;
    const weatherWeighted = weatherPoints * 0.25;

    let congestionPoints = 0;
    switch (congestion) {
      case 'low': congestionPoints = 0; break;
      case 'moderate': congestionPoints = 30; break;
      case 'high': congestionPoints = 70; break;
      case 'critical': congestionPoints = 100; break;
      default: congestionPoints = 20;
    }
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
    if (congestion === 'critical') congestionPenalty = 0.18;
    else if (congestion === 'high') congestionPenalty = 0.12;
    else if (congestion === 'moderate') congestionPenalty = 0.05;

    const distancePenalty = Math.min(0.15, (routeLength / 5000) * 0.15);
    const totalPenalties = histPenalty + weatherPenalty + congestionPenalty + distancePenalty;
    const confidence = Math.max(0.10, Math.round((1.0 - totalPenalties) * 100) / 100);

    const explanation =
      `Fallback Weighted Scoring (ML model unavailable)\n` +
      `-------------------------------------------\n` +
      `1. Base Delay Score: ${histPoints} pts (Weight: 40% -> ${histWeighted.toFixed(1)} pts)\n` +
      `   * Source: ${baseSource} (${baseDelay} min average)\n` +
      `2. Weather Hazard Score: ${weatherPoints} pts (Weight: 25% -> ${weatherWeighted.toFixed(1)} pts)\n` +
      `   * Condition: "${weather}"\n` +
      `3. Node Congestion Score: ${congestionPoints} pts (Weight: 20% -> ${congestionWeighted.toFixed(1)} pts)\n` +
      `   * Active Risk Level: "${congestion.toUpperCase()}"\n` +
      `4. Route Propagation Score: ${routePoints} pts (Weight: 15% -> ${routeWeighted.toFixed(1)} pts)\n` +
      `   * Distance: ${routeLength} km\n` +
      `-------------------------------------------\n` +
      `* Weighted Score Sum: ${weightedScore.toFixed(1)} / 100.0 pts\n` +
      `* Delay Estimate: ${predictedDelay} mins\n` +
      `* Confidence: ${Math.round(confidence * 100)}%`;

    return { predictedDelay, confidence, explanation };
  }
}
