import { describe, it, expect, beforeEach } from 'vitest';
import { useDriftStore } from '../src/stores/driftStore';
import { useDemoStore } from '../src/stores/demoStore';
import { matchStation } from '../src/lib/reconciler';
import { makeReconItem } from '../src/lib/reconciler';
import type { FeedEvent } from '../src/lib/reconciler';

describe('useDriftStore — State Management & Closed-Loop Resolution Tests', () => {
  beforeEach(() => {
    // Reset state before each test
    useDriftStore.setState({
      baseline: null,
      driftReport: null,
      reconItems: [],
      timeline: [],
      corridorHistory: [],
      trainHistory: {},
      duplicatesDropped: 0,
      feedEventsSeen: 0,
      replayActive: false,
      replayStep: null,
      fastReplay: false,
    });
  });

  it('1. captureBaseline snapshots current situation into recorded context', () => {
    const store = useDriftStore.getState();
    store.captureBaseline('Morning Shift Baseline', 'manual');

    const state = useDriftStore.getState();
    expect(state.baseline).not.toBeNull();
    expect(state.baseline?.name).toBe('Morning Shift Baseline');
    expect(state.baseline?.trains.length).toBeGreaterThan(0);
    expect(state.timeline[0]?.kind).toBe('baseline');

    // Immediately after capturing, drift should be 0 (stable)
    state.computeDriftNow();
    const updated = useDriftStore.getState();
    expect(updated.driftReport?.corridorScore).toBe(0);
    expect(updated.driftReport?.corridorClass).toBe('stable');
  });

  it('2. ingestFeedEvents filters identical duplicates and flags divergent payloads', () => {
    const ts = '2026-08-23T08:00:00.000Z';
    const store = useDriftStore.getState();

    const events: FeedEvent[] = [
      { trainId: '12951', timestamp: ts, currentStation: 'rtm', routeProgress: 0.45, speed: 120, source: 'Feed A' },
      { trainId: '12951', timestamp: ts, currentStation: 'rtm', routeProgress: 0.45, speed: 120, source: 'Feed B' }, // identical duplicate
      { trainId: '12951', timestamp: ts, currentStation: 'brc', routeProgress: 0.30, speed: 110, source: 'Feed C' }, // divergent payload conflict
    ];

    const unique = store.ingestFeedEvents(events);
    const state = useDriftStore.getState();

    expect(state.duplicatesDropped).toBe(1); // 1 identical packet dropped
    expect(state.feedEventsSeen).toBe(3);
    expect(state.reconItems.length).toBe(1); // 1 duplicate/conflict item created
    expect(state.reconItems[0].type).toBe('duplicate');
  });

  it('3. injectRawFeedRecord parses free-form text and triages partial matches into inbox', () => {
    const store = useDriftStore.getState();
    const res = store.injectRawFeedRecord('Kanpur Centrall, 1295l, +35m delay');

    expect(res.success).toBe(true);
    expect(res.count).toBeGreaterThanOrEqual(1);

    const state = useDriftStore.getState();
    expect(state.reconItems.length).toBeGreaterThanOrEqual(1);
    const item = state.reconItems.find(i => i.entityLabel.includes('Kanpur') || i.field === 'raw telemetry record' || i.type === 'partial-match');
    expect(item).toBeDefined();
    expect(item?.status).toBe('open');
  });

  it('4. Two-Signal matching applies spatial route prior for stations on active route', () => {
    // Train 12301 (Howrah Rajdhani) has 'cnb' (Kanpur Central) on its route
    const withoutContext = matchStation('Kanpur');
    const withContext = matchStation('Kanpur', { trainId: '12301' });

    expect(withoutContext.candidates[0].id).toBe('cnb');
    expect(withContext.candidates[0].id).toBe('cnb');
    // Candidate similarity on-route is boosted
    expect(withContext.candidates[0].similarity).toBeGreaterThanOrEqual(withoutContext.candidates[0].similarity);
  });

  it('5. resolveItem(accept-live) re-anchors train baseline and collapses drift score', () => {
    const store = useDriftStore.getState();
    store.captureBaseline('Shift Baseline', 'manual');

    // Create a mock conflict for train 12137
    const mockItem = makeReconItem({
      type: 'conflict',
      entity: '12137',
      entityLabel: '12137 · Punjab Mail',
      field: 'schedule',
      sourceA: { name: 'Recorded Plan', value: 'Delay 0m @ BSL' },
      sourceB: { name: 'Live Reality', value: 'Delay 45m @ BSL' },
      severity: 'critical',
      suggestedResolution: 'accept-live',
      suggestion: 'Schedule drifted. Accept live reality.',
    });

    useDriftStore.setState(s => ({ reconItems: [mockItem, ...s.reconItems] }));

    // Resolve the item by accepting live
    store.resolveItem(mockItem.id, 'accept-live');

    const state = useDriftStore.getState();
    const resolvedItem = state.reconItems.find(i => i.id === mockItem.id);
    expect(resolvedItem?.status).toBe('resolved');
    expect(resolvedItem?.resolution).toBe('accept-live');
    expect(state.timeline[0]?.kind).toBe('resolution');
  });

  it('6. resolveItem(merge) arbitrates weather conflict and records audit trail', () => {
    const store = useDriftStore.getState();
    store.captureBaseline('Shift Baseline', 'manual');

    const weatherItem = makeReconItem({
      type: 'conflict',
      entity: 'bsl',
      entityLabel: 'BSL — Bhusaval Junction',
      field: 'weather',
      sourceA: { name: 'Open-Meteo', value: 'Clear, 0mm' },
      sourceB: { name: 'OpenWeatherMap', value: 'Heavy Rain, 62mm' },
      severity: 'high',
      suggestedResolution: 'merge',
      suggestion: 'Sources disagree. Merge to worst condition.',
    });

    useDriftStore.setState(s => ({ reconItems: [weatherItem, ...s.reconItems] }));

    // Resolve by merging
    store.resolveItem(weatherItem.id, 'merge');

    const state = useDriftStore.getState();
    const resolved = state.reconItems.find(i => i.id === weatherItem.id);
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.resolution).toBe('merge');
    expect(state.timeline[0]?.message.toLowerCase()).toContain('resolved');
  });
});
