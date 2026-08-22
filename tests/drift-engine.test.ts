import { describe, it, expect } from 'vitest';
import {
  classifyDrift,
  computeDrift,
  kmAlongRoute,
  weatherClassOf,
  DRIFT_WEIGHTS,
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
  it('maps scores to the documented classes', () => {
    expect(classifyDrift(0)).toBe('stable');
    expect(classifyDrift(14.9)).toBe('stable');
    expect(classifyDrift(15)).toBe('minor');
    expect(classifyDrift(39.9)).toBe('minor');
    expect(classifyDrift(40)).toBe('significant');
    expect(classifyDrift(69.9)).toBe('significant');
    expect(classifyDrift(70)).toBe('critical');
    expect(classifyDrift(100)).toBe('critical');
  });
});

describe('weatherClassOf', () => {
  it('classifies like the prediction engine', () => {
    expect(weatherClassOf(clearWeather())).toBe('Clear');
    expect(weatherClassOf({ ...clearWeather(), rainfall: 60 })).toBe('Heavy Rain');
    expect(weatherClassOf({ ...clearWeather(), rainfall: 5 })).toBe('Rain');
    expect(weatherClassOf({ ...clearWeather(), visibility: 0.5 })).toBe('Fog');
    expect(weatherClassOf({ ...clearWeather(), description: 'Dense fog' })).toBe('Fog');
    expect(weatherClassOf(undefined)).toBe('Unknown');
  });
});

describe('kmAlongRoute', () => {
  it('is 0 at the origin and monotonic along the route', () => {
    const origin = kmAlongRoute('12951', 'mmct', 0);
    const mid = kmAlongRoute('12951', 'brc', 0.5);
    const later = kmAlongRoute('12951', 'kota', 0.2);
    expect(origin).toBe(0);
    expect(mid).toBeGreaterThan(origin);
    expect(later).toBeGreaterThan(mid);
  });
});

describe('computeDrift', () => {
  it('reports zero drift when nothing changed', () => {
    const train = makeTrain();
    const weather = { brc: clearWeather(), rtm: clearWeather() };
    const report = computeDrift(makeBaseline([train], weather), makeLive([{ ...train }], weather));
    expect(report.corridorScore).toBe(0);
    expect(report.corridorClass).toBe('stable');
    expect(report.trains[0].score).toBe(0);
  });

  it('scores pure schedule drift with the 0.40 weight', () => {
    const base = makeTrain({ predictedDelay: 0 });
    // +45 min = the normalisation ceiling → schedule component = 100 pts
    const live = makeTrain({ predictedDelay: 45 });
    const weather = { brc: clearWeather(), rtm: clearWeather() };
    const report = computeDrift(makeBaseline([base], weather), makeLive([live], weather));
    const schedule = report.trains[0].components.find(c => c.key === 'schedule')!;
    expect(schedule.normalized).toBe(100);
    expect(schedule.weighted).toBe(100 * DRIFT_WEIGHTS.schedule);
    expect(report.trains[0].score).toBe(40);
    expect(report.trains[0].driftClass).toBe('significant');
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
    expect(weatherComp.normalized).toBe(100); // class change (60) + Δmm capped (40)
    expect(predComp.normalized).toBeGreaterThanOrEqual(60); // assumption invalidated
    expect(t.score).toBeGreaterThan(0);
  });

  it('re-anchors position projection from a per-train snapshotAt', () => {
    const capturedAt = T0;
    const thirtyLater = '2026-08-22T10:30:00.000Z';
    // Train accepted-live at t+30: snapshotAt = now, position = live position
    const base = makeTrain({ snapshotAt: thirtyLater });
    const live = makeTrain();
    const weather = { brc: clearWeather(), rtm: clearWeather() };
    const baseline = { ...makeBaseline([base], weather), capturedAt };
    const report = computeDrift(baseline, makeLive([live], weather, thirtyLater));
    const position = report.trains[0].components.find(c => c.key === 'position')!;
    // No time has passed since the re-anchor → no phantom position drift
    expect(position.normalized).toBe(0);
  });

  it('weights the corridor score by passenger exposure', () => {
    const big = makeTrain({ trainId: '12137', trainName: 'Punjab Mail', currentStation: 'bpl', nextStation: 'agc', passengerCount: 1600, predictedDelay: 0 });
    const bigDrifted = { ...big, predictedDelay: 45 };
    const small = makeTrain({ trainId: '12007', trainName: 'Chennai Shatabdi', currentStation: 'kpd', nextStation: 'jtj', passengerCount: 100, predictedDelay: 0 });
    const weather = {};
    const report = computeDrift(
      makeBaseline([big, small], weather),
      makeLive([bigDrifted, { ...small }], weather),
    );
    // 1600-passenger train at 40, 100-passenger train at 0 → weighted mean ≈ 37.6, not 20
    expect(report.corridorScore).toBeGreaterThan(30);
  });
});
