import { describe, it, expect } from 'vitest';
import {
  classifyDrift,
  computeDrift,
  kmAlongRoute,
  coordsAtKm,
  weatherClassOf,
  DRIFT_WEIGHTS,
  DRIFT_CEILINGS,
  DRIFT_THRESHOLDS,
} from '../src/lib/drift-engine';
import type { BaselineSnapshot, BaselineTrainSnapshot, LiveSnapshot, WeatherSnapshot } from '../src/data/types';

const T0 = '2026-08-22T10:00:00.000Z';

function makeTrain(overrides: Partial<BaselineTrainSnapshot> = {}): BaselineTrainSnapshot {
  return {
    trainId: '12951',
    trainName: 'Mumbai Rajdhani Express',
    currentStation: 'brc',
    nextStation: 'rtm',
    routeProgress: 0.5,
    coordinates: [74.1, 22.8],
    speed: 130,
    passengerCount: 920,
    predictedDelay: 10,
    confidence: 0.8,
    weatherConditionAtNext: 'Clear',
    snapshotAt: T0,
    ...overrides,
  };
}

function clearWeather(): WeatherSnapshot {
  return { rainfall: 0, description: 'Clear sky', temperature: 30, visibility: 10, source: 'live' };
}

function makeBaseline(trains: BaselineTrainSnapshot[], weather: Record<string, WeatherSnapshot> = {}): BaselineSnapshot {
  return { id: 'bl-test', name: 'Test baseline', capturedAt: T0, source: 'manual', trains, weather };
}

function makeLive(trains: BaselineTrainSnapshot[], weather: Record<string, WeatherSnapshot> = {}, at = T0): LiveSnapshot {
  return { at, trains, weather };
}

describe('classifyDrift', () => {
  it('maps numerical scores to documented severity classes', () => {
    expect(classifyDrift(0)).toBe('stable');
    expect(classifyDrift(14.9)).toBe('stable');
    expect(classifyDrift(15)).toBe('minor');
    expect(classifyDrift(39.9)).toBe('minor');
    expect(classifyDrift(40)).toBe('significant');
    expect(classifyDrift(69.9)).toBe('significant');
    expect(classifyDrift(70)).toBe('critical');
    expect(classifyDrift(100)).toBe('critical');
    expect(classifyDrift(150)).toBe('critical');
  });

  it('verifies threshold consistency', () => {
    expect(DRIFT_THRESHOLDS).toHaveLength(4);
    expect(DRIFT_THRESHOLDS[0].cls).toBe('stable');
    expect(DRIFT_THRESHOLDS[3].cls).toBe('critical');
  });
});

describe('weatherClassOf', () => {
  it('categorizes weather snapshots identically to the prediction engine', () => {
    expect(weatherClassOf(clearWeather())).toBe('Clear');
    expect(weatherClassOf({ ...clearWeather(), rainfall: 60 })).toBe('Heavy Rain');
    expect(weatherClassOf({ ...clearWeather(), rainfall: 12 })).toBe('Rain');
    expect(weatherClassOf({ ...clearWeather(), visibility: 0.5 })).toBe('Fog');
    expect(weatherClassOf({ ...clearWeather(), description: 'Dense fog and mist' })).toBe('Fog');
    expect(weatherClassOf({ ...clearWeather(), description: 'Thunderstorm with heavy rain' })).toBe('Heavy Rain');
    expect(weatherClassOf({ ...clearWeather(), description: 'Scattered light showers' })).toBe('Rain');
    expect(weatherClassOf(undefined)).toBe('Unknown');
  });
});

describe('kmAlongRoute & coordsAtKm geometry helpers', () => {
  it('is 0 at origin and increases monotonically', () => {
    const origin = kmAlongRoute('12951', 'mmct', 0);
    const mid = kmAlongRoute('12951', 'brc', 0.5);
    const later = kmAlongRoute('12951', 'kota', 0.2);
    expect(origin).toBe(0);
    expect(mid).toBeGreaterThan(origin);
    expect(later).toBeGreaterThan(mid);
  });

  it('handles clamped route boundaries gracefully', () => {
    const end = kmAlongRoute('12951', 'ndls', 1.0);
    expect(end).toBeGreaterThan(1200);
    expect(kmAlongRoute('12951', 'unknown_station', 0.5)).toBe(0);
  });

  it('interpolates geographical coordinates along km accurately', () => {
    const coordsStart = coordsAtKm('12951', 0);
    const coordsMid = coordsAtKm('12951', 400);
    expect(coordsStart).toHaveLength(2);
    expect(coordsMid).toHaveLength(2);
    expect(coordsStart[0]).not.toEqual(coordsMid[0]);
  });
});

describe('computeDrift — Multi-variable drift engine', () => {
  it('reports zero drift when live reality matches the baseline perfectly', () => {
    const train = makeTrain();
    const weather = { brc: clearWeather(), rtm: clearWeather() };
    const report = computeDrift(makeBaseline([train], weather), makeLive([{ ...train }], weather));
    expect(report.corridorScore).toBe(0);
    expect(report.corridorClass).toBe('stable');
    expect(report.trains[0].score).toBe(0);
    expect(report.trains[0].components).toHaveLength(4);
  });

  it('scores schedule drift accurately with 0.40 weight and 45min ceiling', () => {
    const base = makeTrain({ predictedDelay: 0 });
    // +45 min = normalisation ceiling → schedule score = 100 pts normalized, 40 pts weighted
    const live = makeTrain({ predictedDelay: 45 });
    const weather = { brc: clearWeather(), rtm: clearWeather() };
    const report = computeDrift(makeBaseline([base], weather), makeLive([live], weather));
    const schedule = report.trains[0].components.find(c => c.key === 'schedule')!;
    expect(schedule.normalized).toBe(100);
    expect(schedule.weighted).toBe(100 * DRIFT_WEIGHTS.schedule);
    expect(report.trains[0].score).toBe(40);
    expect(report.trains[0].driftClass).toBe('significant');
  });

  it('caps schedule drift above ceiling to 100 normalized points', () => {
    const base = makeTrain({ predictedDelay: 0 });
    const live = makeTrain({ predictedDelay: 90 });
    const weather = {};
    const report = computeDrift(makeBaseline([base], weather), makeLive([live], weather));
    const schedule = report.trains[0].components.find(c => c.key === 'schedule')!;
    expect(schedule.normalized).toBe(100);
    expect(schedule.weighted).toBe(40);
  });

  it('detects weather drift and invalidated prediction assumptions', () => {
    const base = makeTrain({ weatherConditionAtNext: 'Clear' });
    const live = makeTrain({ weatherConditionAtNext: 'Heavy Rain' });
    const baseWeather = { brc: clearWeather(), rtm: clearWeather() };
    const liveWeather = {
      brc: clearWeather(),
      rtm: { ...clearWeather(), rainfall: 62, description: 'Violent rain showers', visibility: 2.5 },
    };
    const report = computeDrift(makeBaseline([base], baseWeather), makeLive([live], liveWeather));
    const t = report.trains[0];
    const weatherComp = t.components.find(c => c.key === 'weather')!;
    const predComp = t.components.find(c => c.key === 'prediction')!;
    expect(weatherComp.normalized).toBe(100);
    expect(predComp.normalized).toBeGreaterThanOrEqual(60);
    expect(t.score).toBeGreaterThan(0);
  });

  it('re-anchors position projection accurately when operator accepts live reality', () => {
    const capturedAt = T0;
    const thirtyLater = '2026-08-22T10:30:00.000Z';
    const base = makeTrain({ snapshotAt: thirtyLater });
    const live = makeTrain();
    const weather = { brc: clearWeather(), rtm: clearWeather() };
    const baseline = { ...makeBaseline([base], weather), capturedAt };
    const report = computeDrift(baseline, makeLive([live], weather, thirtyLater));
    const position = report.trains[0].components.find(c => c.key === 'position')!;
    expect(position.normalized).toBe(0);
  });

  it('calculates corridor score weighted by passenger exposure', () => {
    const bigTrain = makeTrain({ trainId: '12137', trainName: 'Punjab Mail', currentStation: 'bpl', nextStation: 'agc', passengerCount: 1600, predictedDelay: 0 });
    const bigDrifted = { ...bigTrain, predictedDelay: 45 };
    const smallTrain = makeTrain({ trainId: '12007', trainName: 'Chennai Shatabdi', currentStation: 'kpd', nextStation: 'jtj', passengerCount: 100, predictedDelay: 0 });
    const weather = {};
    const report = computeDrift(
      makeBaseline([bigTrain, smallTrain], weather),
      makeLive([bigDrifted, { ...smallTrain }], weather),
    );
    expect(report.corridorScore).toBeGreaterThan(30);
  });

  it('generates rich human-readable explanation strings with feature contributions', () => {
    const base = makeTrain({ predictedDelay: 0 });
    const live = makeTrain({ predictedDelay: 30 });
    const weather = {};
    const report = computeDrift(makeBaseline([base], weather), makeLive([live], weather));
    const explanation = report.trains[0].explanation;
    expect(explanation).toContain('Mumbai Rajdhani Express drift');
    expect(explanation).toContain('Schedule drift:');
    expect(explanation).toContain('Position drift:');
  });

  it('computes relative delay drift correctly during replay: baseline 45 min + override +48 min yields schedule normalized = 100', () => {
    const baseDelay = 45;
    const overrideDelay = baseDelay + 48; // t=50s override
    const base = makeTrain({ trainId: '12137', predictedDelay: baseDelay });
    const live = makeTrain({ trainId: '12137', predictedDelay: overrideDelay });
    const report = computeDrift(makeBaseline([base]), makeLive([live]));
    const scheduleComp = report.trains[0].components.find(c => c.key === 'schedule')!;
    // Delta is 48min, Ceiling is 45min -> 48/45 * 100 = 106.66 capped at 100
    expect(scheduleComp.raw).toBe(48);
    expect(scheduleComp.normalized).toBe(100);
    expect(scheduleComp.weighted).toBe(40); // 100 * 0.40
  });

  it('weather override applied to nextStation produces weather component > 0 and prediction component >= 60', () => {
    const base = makeTrain({ currentStation: 'bpl', nextStation: 'bsl', weatherConditionAtNext: 'Clear' });
    const baseWeather = { bsl: clearWeather(), bpl: clearWeather() };
    const liveWeather = {
      bpl: { ...clearWeather(), rainfall: 24, description: 'Moderate rain' },
      bsl: { ...clearWeather(), rainfall: 62, description: 'Violent rain showers', visibility: 2.5 },
    };
    const live = makeTrain({
      currentStation: 'bpl',
      nextStation: 'bsl',
      weatherConditionAtNext: weatherClassOf(liveWeather.bsl),
    });
    const report = computeDrift(makeBaseline([base], baseWeather), makeLive([live], liveWeather));
    const t = report.trains[0];
    const weatherComp = t.components.find(c => c.key === 'weather')!;
    const predComp = t.components.find(c => c.key === 'prediction')!;
    expect(weatherComp.raw).toBe(62);
    expect(weatherComp.normalized).toBe(100);
    expect(weatherComp.weighted).toBeGreaterThan(0);
    expect(predComp.normalized).toBeGreaterThanOrEqual(60);
  });
});
