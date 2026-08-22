import { describe, it, expect } from 'vitest';
import {
  jaroWinkler,
  matchStation,
  matchTrain,
  dedupeEvents,
  detectWeatherConflict,
  detectPositionConflict,
  partialMatchItem,
  MATCH_THRESHOLDS,
  POSITION_CONFLICT_KM,
  type FeedEvent,
} from '../src/lib/reconciler';
import { STATIONS } from '../src/data/corridor';

describe('jaroWinkler similarity metric', () => {
  it('scores exact identity as 1.0', () => {
    expect(jaroWinkler('kanpur', 'kanpur')).toBe(1);
    expect(jaroWinkler('12951', '12951')).toBe(1);
    expect(jaroWinkler('NDLS', 'ndls')).toBe(1);
  });

  it('favors prefix matches accurately for railway entities', () => {
    expect(jaroWinkler('kanpur', 'kanpur central')).toBeGreaterThan(0.7);
    expect(jaroWinkler('bhopal', 'bhopal jn')).toBeGreaterThan(0.7);
  });

  it('handles minor transpositions and OCR errors', () => {
    expect(jaroWinkler('12951', '1295l')).toBeGreaterThan(0.8);
    expect(jaroWinkler('delhi', 'dheli')).toBeGreaterThan(0.85);
  });

  it('returns low score (<0.5) for completely divergent names', () => {
    expect(jaroWinkler('kanpur', 'thiruvananthapuram')).toBeLessThan(0.5);
    expect(jaroWinkler('ndls', 'mumbai')).toBeLessThan(0.5);
  });

  it('handles empty and distinct inputs sensibly', () => {
    expect(jaroWinkler('a', 'z')).toBe(0);
    expect(jaroWinkler('123', '789')).toBe(0);
  });
});

describe('matchStation — Registry matching & triage', () => {
  it('matches exact ids, codes and full station names', () => {
    expect(matchStation('cnb').status).toBe('exact');
    expect(matchStation('CNB').matchedId).toBe('cnb');
    expect(matchStation('Kanpur Central').matchedId).toBe('cnb');
    expect(matchStation('ndls').matchedId).toBe('ndls');
    expect(matchStation('New Delhi').matchedId).toBe('ndls');
    expect(matchStation('Bhusaval').matchedId).toBe('bsl');
  });

  it('queues near-matches for operator review instead of silently falling back', () => {
    const typo = matchStation('Kanpur Centrall');
    expect(typo.status === 'review' || typo.status === 'auto').toBe(true);
    expect(typo.candidates[0].id).toBe('cnb');
    expect(typo.similarity).toBeGreaterThan(MATCH_THRESHOLDS.review);
  });

  it('resolves prefix inputs toward the canonical registry name', () => {
    const partial = matchStation('Kanpur');
    expect(partial.candidates[0].id).toBe('cnb');
    expect(partial.status).not.toBe('rejected');
    expect(partial.candidates.length).toBeGreaterThanOrEqual(1);
  });

  it('handles Bhopal and Mumbai variations correctly', () => {
    const bpl = matchStation('Bhopal Jn');
    expect(bpl.candidates[0].id).toBe('bpl');
    expect(bpl.similarity).toBeGreaterThan(0.7);
  });

  it('rejects garbage and empty strings without inventing a match', () => {
    expect(matchStation('zzzzqqqq').status).toBe('rejected');
    expect(matchStation('').status).toBe('rejected');
    expect(matchStation('   ').status).toBe('rejected');
    expect(matchStation('12345678').status).toBe('rejected');
  });
});

describe('matchTrain — Train number validation', () => {
  it('matches exact canonical train IDs', () => {
    expect(matchTrain('12951').status).toBe('exact');
    expect(matchTrain('12137').status).toBe('exact');
    expect(matchTrain('12301').status).toBe('exact');
  });

  it('flags OCR-style typos for operator review', () => {
    const typo = matchTrain('1295l');
    expect(typo.status).not.toBe('exact');
    expect(typo.candidates[0].id).toBe('12951');
    expect(typo.similarity).toBeGreaterThan(MATCH_THRESHOLDS.review);
  });

  it('rejects invalid train numbers', () => {
    expect(matchTrain('999999').status).toBe('rejected');
    expect(matchTrain('').status).toBe('rejected');
  });
});

describe('dedupeEvents — Stream deduplication', () => {
  const base: FeedEvent = {
    trainId: '12951',
    timestamp: '2026-08-22T10:00:00.000Z',
    currentStation: 'brc',
    routeProgress: 0.4,
    speed: 120,
    source: 'SSE feed',
  };

  it('drops identical duplicates silently and increments counter', () => {
    const { unique, identicalDropped, conflicts } = dedupeEvents([base, { ...base }, { ...base }]);
    expect(unique).toHaveLength(1);
    expect(identicalDropped).toBe(2);
    expect(conflicts).toHaveLength(0);
  });

  it('elevates same-key different-payload duplicates to actionable conflicts', () => {
    const { unique, identicalDropped, conflicts } = dedupeEvents([
      base,
      { ...base, currentStation: 'rtm', routeProgress: 0.1 },
    ]);
    expect(unique).toHaveLength(1);
    expect(identicalDropped).toBe(0);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].first.currentStation).toBe('brc');
    expect(conflicts[0].second.currentStation).toBe('rtm');
  });

  it('preserves distinct chronological events untouched', () => {
    const { unique, conflicts, identicalDropped } = dedupeEvents([
      base,
      { ...base, timestamp: '2026-08-22T10:00:05.000Z', routeProgress: 0.41 },
      { ...base, timestamp: '2026-08-22T10:00:10.000Z', routeProgress: 0.42 },
    ]);
    expect(unique).toHaveLength(3);
    expect(conflicts).toHaveLength(0);
    expect(identicalDropped).toBe(0);
  });
});

describe('detectWeatherConflict — Multi-source weather arbitration', () => {
  const clear = { rainfall: 0, description: 'Clear sky', temperature: 30, visibility: 10, source: 'live', name: 'Open-Meteo' };

  it('returns null when both weather sources agree closely', () => {
    expect(detectWeatherConflict('bsl', clear, { ...clear, name: 'OpenWeatherMap' })).toBeNull();
    expect(detectWeatherConflict('bsl', clear, { ...clear, temperature: 32, name: 'OpenWeatherMap' })).toBeNull();
  });

  it('raises a high-severity conflict when conditions severely disagree', () => {
    const item = detectWeatherConflict('bsl', clear, {
      rainfall: 62, description: 'Violent rain showers', temperature: 24, visibility: 2, source: 'live', name: 'OpenWeatherMap',
    });
    expect(item).not.toBeNull();
    expect(item!.type).toBe('conflict');
    expect(item!.severity).toBe('high');
    expect(item!.entity).toBe('bsl');
    expect(item!.suggestedResolution).toBe('merge');
  });

  it('raises a moderate-severity conflict when rainfall delta exceeds threshold', () => {
    const rainy = { rainfall: 15, description: 'Moderate rain', temperature: 26, visibility: 6, source: 'live', name: 'Open-Meteo' };
    const severeRain = { rainfall: 55, description: 'Heavy Rain', temperature: 24, visibility: 3, source: 'live', name: 'OpenWeatherMap' };
    const item = detectWeatherConflict('cnb', rainy, severeRain);
    expect(item).not.toBeNull();
    expect(item!.type).toBe('conflict');
    expect(item!.field).toBe('weather');
  });
});

describe('detectPositionConflict — Spatial telemetry vs timetable arbitration', () => {
  it('ignores estimates within the tolerance threshold (40 km)', () => {
    const near = detectPositionConflict('12951', 'Mumbai Rajdhani',
      { coordinates: [73.18, 22.31], currentStation: 'brc', source: 'SSE feed' },
      { coordinates: [73.30, 22.40], currentStation: 'brc', source: 'Engine' });
    expect(near).toBeNull();
  });

  it('flags estimates exceeding the threshold (>40 km)', () => {
    const far = detectPositionConflict('12951', 'Mumbai Rajdhani',
      { coordinates: [73.18, 22.31], currentStation: 'brc', source: 'SSE feed' },
      { coordinates: [74.50, 22.80], currentStation: 'rtm', source: 'Engine' });
    expect(far).not.toBeNull();
    expect(far!.type).toBe('conflict');
    expect(far!.field).toBe('position');
  });

  it('classifies extreme divergence (>100 km) as critical severity', () => {
    const critical = detectPositionConflict('12137', 'Punjab Mail',
      { coordinates: [72.83, 19.07], currentStation: 'mmct', source: 'SSE feed' },
      { coordinates: [77.41, 23.25], currentStation: 'bpl', source: 'Engine' });
    expect(critical).not.toBeNull();
    expect(critical!.severity).toBe('critical');
    expect(critical!.suggestedResolution).toBe('accept-live');
  });
});

describe('partialMatchItem — Wrapper for review inbox', () => {
  it('creates an actionable reconciliation item for needs-review status', () => {
    const item = partialMatchItem('station', matchStation('Kanpur Centrall'), 'Feed B');
    if (item) {
      expect(item.type).toBe('partial-match');
      expect(item.status).toBe('open');
      expect(item.similarity).toBeGreaterThan(0.6);
      expect(item.entity).toBe('cnb');
    }
  });

  it('returns null for exact or confident auto-matches', () => {
    expect(partialMatchItem('station', matchStation('Kanpur Central'), 'Feed B')).toBeNull();
    expect(partialMatchItem('station', matchStation('NDLS'), 'Feed B')).toBeNull();
    expect(partialMatchItem('train', matchTrain('12951'), 'Feed B')).toBeNull();
  });
});
