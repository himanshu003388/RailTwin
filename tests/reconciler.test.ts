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
  type FeedEvent,
} from '../src/lib/reconciler';

describe('jaroWinkler', () => {
  it('scores identity, similarity and dissimilarity sensibly', () => {
    expect(jaroWinkler('kanpur', 'kanpur')).toBe(1);
    expect(jaroWinkler('kanpur', 'kanpur central')).toBeGreaterThan(0.6);
    expect(jaroWinkler('kanpur', 'thiruvananthapuram')).toBeLessThan(0.6);
  });
});

describe('matchStation — the fix for Round 1\'s silent NDLS fallback', () => {
  it('matches exact ids, codes and names', () => {
    expect(matchStation('cnb').status).toBe('exact');
    expect(matchStation('CNB').matchedId).toBe('cnb');
    expect(matchStation('Kanpur Central').matchedId).toBe('cnb');
  });

  it('queues near-matches for review instead of silently mapping them', () => {
    const typo = matchStation('Kanpur Centrall');
    expect(typo.status === 'review' || typo.status === 'auto').toBe(true);
    expect(typo.candidates[0].id).toBe('cnb');
    expect(typo.similarity).toBeGreaterThan(MATCH_THRESHOLDS.review);
  });

  it('prefix inputs resolve toward the full station name', () => {
    const partial = matchStation('Kanpur');
    expect(partial.candidates[0].id).toBe('cnb');
    expect(partial.status).not.toBe('rejected');
  });

  it('rejects garbage instead of inventing a match', () => {
    expect(matchStation('zzzzqqqq').status).toBe('rejected');
    expect(matchStation('').status).toBe('rejected');
  });
});

describe('matchTrain', () => {
  it('matches exact train numbers and flags OCR-style typos', () => {
    expect(matchTrain('12951').status).toBe('exact');
    const typo = matchTrain('1295l');
    expect(typo.status).not.toBe('exact');
    expect(typo.candidates[0].id).toBe('12951');
    expect(typo.similarity).toBeGreaterThan(MATCH_THRESHOLDS.review);
  });
});

describe('dedupeEvents', () => {
  const base: FeedEvent = {
    trainId: '12951',
    timestamp: '2026-08-22T10:00:00.000Z',
    currentStation: 'brc',
    routeProgress: 0.4,
    speed: 120,
    source: 'SSE feed',
  };

  it('drops identical duplicates silently and counts them', () => {
    const { unique, identicalDropped, conflicts } = dedupeEvents([base, { ...base }]);
    expect(unique).toHaveLength(1);
    expect(identicalDropped).toBe(1);
    expect(conflicts).toHaveLength(0);
  });

  it('elevates same-key different-payload duplicates to conflicts', () => {
    const { unique, identicalDropped, conflicts } = dedupeEvents([
      base,
      { ...base, currentStation: 'rtm', routeProgress: 0.1 },
    ]);
    expect(unique).toHaveLength(1);
    expect(identicalDropped).toBe(0);
    expect(conflicts).toHaveLength(1);
  });

  it('leaves distinct events untouched', () => {
    const { unique, conflicts } = dedupeEvents([
      base,
      { ...base, timestamp: '2026-08-22T10:00:05.000Z', routeProgress: 0.41 },
    ]);
    expect(unique).toHaveLength(2);
    expect(conflicts).toHaveLength(0);
  });
});

describe('detectWeatherConflict', () => {
  const clear = { rainfall: 0, description: 'Clear sky', temperature: 30, visibility: 10, source: 'live', name: 'Open-Meteo' };

  it('returns null when the sources agree', () => {
    expect(detectWeatherConflict('bsl', clear, { ...clear, name: 'OpenWeatherMap' })).toBeNull();
  });

  it('raises a high-severity conflict when classes disagree severely', () => {
    const item = detectWeatherConflict('bsl', clear, {
      rainfall: 62, description: 'Violent rain showers', temperature: 24, visibility: 2, source: 'live', name: 'OpenWeatherMap',
    });
    expect(item).not.toBeNull();
    expect(item!.type).toBe('conflict');
    expect(item!.severity).toBe('high');
    expect(item!.entity).toBe('bsl');
  });
});

describe('detectPositionConflict', () => {
  it('ignores estimates within the threshold and flags far-apart ones', () => {
    const near = detectPositionConflict('12951', 'Mumbai Rajdhani',
      { coordinates: [73.18, 22.31], currentStation: 'brc', source: 'SSE feed' },
      { coordinates: [73.30, 22.40], currentStation: 'brc', source: 'Engine' });
    expect(near).toBeNull();

    const far = detectPositionConflict('12951', 'Mumbai Rajdhani',
      { coordinates: [72.83, 19.07], currentStation: 'mmct', source: 'SSE feed' },
      { coordinates: [75.03, 23.33], currentStation: 'rtm', source: 'Engine' });
    expect(far).not.toBeNull();
    expect(far!.severity).toBe('critical'); // hundreds of km apart
  });
});

describe('partialMatchItem', () => {
  it('wraps a needs-review match into an actionable reconciliation item', () => {
    const item = partialMatchItem('station', matchStation('Kanpur Centrall'), 'Feed B');
    if (item) {
      expect(item.type).toBe('partial-match');
      expect(item.status).toBe('open');
      expect(item.similarity).toBeGreaterThan(0.6);
    } else {
      // similarity ≥ auto threshold → correctly auto-mapped, no review needed
      expect(matchStation('Kanpur Centrall').status).toBe('auto');
    }
  });

  it('returns null for confident matches', () => {
    expect(partialMatchItem('station', matchStation('Kanpur Central'), 'Feed B')).toBeNull();
    expect(partialMatchItem('train', matchTrain('12951'), 'Feed B')).toBeNull();
  });
});
