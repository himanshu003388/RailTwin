import { railwayDataset } from './RailwayDatasetService';

export interface PredictionInput {
  trainNo: string;
  routeLengthKm: number;
  stationCongestion: 'low' | 'moderate' | 'high' | 'critical';
  weatherCondition: string; // e.g. 'Clear', 'Rain', 'Fog', 'Heavy Rain'
  rainfallMmHr?: number;
}

export interface PredictionOutput {
  predictedDelay: number; // in minutes
  confidence: number; // between 0.0 and 1.0
  explanation: string; // detailed explanation text
}

export class HistoricalDelayPredictionEngine {
  /**
   * Predicts train delay based on historical delay logs, route length,
   * station congestion, and active weather using a simple weighted scoring model.
   *
   * @param input - Delay prediction inputs
   * @returns PredictionOutput containing predicted delay, confidence, and mathematical explanation
   */
  public static async predict(input: PredictionInput): Promise<PredictionOutput> {
    const trainNo = input.trainNo;
    const routeLength = input.routeLengthKm;
    const congestion = input.stationCongestion || 'low';
    const weather = input.weatherCondition || 'Clear';

    // 1. Fetch historical delay stats
    const stats = await railwayDataset.getDelayStats(trainNo);
    
    let baseDelay = 15; // default fallback if no history exists
    let recordCount = 0;
    let baseSource = 'Global default baseline';

    if (stats) {
      recordCount = stats.recordCount;
      // Check if we have records matching this specific weather condition
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

    // 2. Score Component: Historical Base (Weight: 40%)
    // Base delay mapped to points (60 minutes delay is 100 points, capped)
    const histPoints = Math.min(100, Math.round((baseDelay / 60) * 100));
    const histWeighted = histPoints * 0.40;

    // 3. Score Component: Weather (Weight: 25%)
    let weatherPoints = 0;
    const weatherLower = weather.toLowerCase();
    
    if (weatherLower.includes('fog')) {
      weatherPoints = 100;
    } else if (weatherLower.includes('heavy') || input.rainfallMmHr && input.rainfallMmHr > 50) {
      weatherPoints = 75;
    } else if (weatherLower.includes('rain') || weatherLower.includes('monsoon')) {
      weatherPoints = 40;
    } else if (weatherLower.includes('clear') || weatherLower.includes('good')) {
      weatherPoints = 0;
    } else {
      weatherPoints = 20; // light clouds or other weather
    }
    const weatherWeighted = weatherPoints * 0.25;

    // 4. Score Component: Station Congestion (Weight: 20%)
    let congestionPoints = 0;
    switch (congestion) {
      case 'low':
        congestionPoints = 0;
        break;
      case 'moderate':
        congestionPoints = 30;
        break;
      case 'high':
        congestionPoints = 70;
        break;
      case 'critical':
        congestionPoints = 100;
        break;
      default:
        congestionPoints = 20;
    }
    const congestionWeighted = congestionPoints * 0.20;

    // 5. Score Component: Route Length (Weight: 15%)
    // Scaled to 1500 km = 100 points
    const routePoints = Math.min(100, Math.round((routeLength / 1500) * 100));
    const routeWeighted = routePoints * 0.15;

    // 6. Weighted Sum and Final Prediction (Max delay mapped to 120 mins)
    const weightedScore = histWeighted + weatherWeighted + congestionWeighted + routeWeighted;
    const predictedDelay = Math.round((weightedScore / 100) * 120);

    // 7. Confidence Score Calculations (reducing from 1.0)
    let histPenalty = 0.25; // low reliability if no records
    if (recordCount >= 10) {
      histPenalty = 0.0;
    } else if (recordCount >= 5) {
      histPenalty = 0.05;
    } else if (recordCount >= 1) {
      histPenalty = 0.10;
    }

    let weatherPenalty = 0.0;
    if (weatherLower.includes('fog')) {
      weatherPenalty = 0.20;
    } else if (weatherLower.includes('heavy')) {
      weatherPenalty = 0.15;
    } else if (weatherLower.includes('rain')) {
      weatherPenalty = 0.08;
    }

    let congestionPenalty = 0.0;
    if (congestion === 'critical') {
      congestionPenalty = 0.18;
    } else if (congestion === 'high') {
      congestionPenalty = 0.12;
    } else if (congestion === 'moderate') {
      congestionPenalty = 0.05;
    }

    // Distance uncertainty (longer route = more unforeseen events)
    const distancePenalty = Math.min(0.15, (routeLength / 5000) * 0.15);

    const totalPenalties = histPenalty + weatherPenalty + congestionPenalty + distancePenalty;
    const confidence = Math.max(0.10, Math.round((1.0 - totalPenalties) * 100) / 100);

    // 8. Detailed string explanation detailing every component of the calculation
    const explanation = 
      `Prediction Engine Execution Report:\n` +
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
      `* Delay Estimate Formula: Math.round(${weightedScore.toFixed(1)}% of 120 mins) = ${predictedDelay} mins\n` +
      `* Confidence Level: ${Math.round(confidence * 100)}%\n` +
      `  - Deductions: Historical Logs (-${Math.round(histPenalty * 100)}%), Weather Hazard (-${Math.round(weatherPenalty * 100)}%), Congestion Volatility (-${Math.round(congestionPenalty * 100)}%), Route Distance Variance (-${Math.round(distancePenalty * 100)}%)`;

    return {
      predictedDelay,
      confidence,
      explanation
    };
  }
}
