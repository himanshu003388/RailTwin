import React, { useState, useMemo } from 'react';
import { useDriftStore } from '../../stores/driftStore';
import { RiskBadge } from '../ui/RiskBadge';
import {
  GitCompare, Pin, Play, Square, AlertTriangle, CheckCircle2, Clock, Copy, CloudRain, MapPin, FileDown, Printer,
  FlaskConical, Wand2, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { useDemoStore } from '../../stores/demoStore';
import { downloadHandoverMarkdown, printHandoverReport, type HandoverData } from '../../lib/export-report';
import {
  matchStation,
  matchTrain,
  partialMatchItem,
  detectWeatherConflict,
  detectPositionConflict,
} from '../../lib/reconciler';
import type { DriftClass, ReconciliationItem, TrainDrift } from '../../data/types';

const CLASS_COLOR: Record<DriftClass, string> = {
  stable: 'var(--color-risk-low)',
  minor: 'var(--color-risk-moderate)',
  significant: 'var(--color-risk-high)',
  critical: 'var(--color-risk-critical)',
};

const CLASS_TO_RISK: Record<DriftClass, 'low' | 'moderate' | 'high' | 'critical'> = {
  stable: 'low', minor: 'moderate', significant: 'high', critical: 'critical',
};

const TYPE_META: Record<ReconciliationItem['type'], { label: string; color: string; icon: React.ReactNode }> = {
  'conflict': { label: 'CONFLICT', color: 'var(--color-accent-red)', icon: <AlertTriangle className="w-3 h-3" /> },
  'duplicate': { label: 'DUPLICATE', color: 'var(--color-accent-amber)', icon: <Copy className="w-3 h-3" /> },
  'partial-match': { label: 'PARTIAL MATCH', color: 'var(--color-accent-purple)', icon: <GitCompare className="w-3 h-3" /> },
};

const Sparkline: React.FC<{ points: number[]; color: string }> = ({ points, color }) => {
  if (!points || points.length < 2) {
    return <span className="text-[9px] text-text-muted font-mono">—</span>;
  }
  const w = 72, h = 20;
  const max = Math.max(100, ...points);
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

const TrainDriftRow: React.FC<{ t: TrainDrift; history: number[] }> = ({ t, history }) => {
  const [open, setOpen] = useState(false);
  const color = CLASS_COLOR[t.driftClass];
  return (
    <div className="border border-border-default rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-elevated/50 transition-colors"
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[12px] font-mono font-bold text-text-primary truncate">{t.trainId} · {t.trainName}</span>
          <span className="text-[9px] font-mono text-text-tertiary uppercase">
            {t.live.station.toUpperCase()} → {t.live.nextStation.toUpperCase()} · Δdelay {Math.abs(t.live.delay - t.baseline.delay)}min
          </span>
        </div>
        <Sparkline points={history} color={color} />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-mono font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(t.score)}
          </span>
          <RiskBadge level={CLASS_TO_RISK[t.driftClass]} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border-subtle flex flex-col gap-2">
          {t.components.map(c => (
            <div key={c.key} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-secondary">{c.label} <span className="text-text-muted">× {c.weight}</span></span>
                <span style={{ color }} className="font-bold">{c.weighted} pts</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                <div className="h-full rounded-full" style={{ width: `${c.normalized}%`, background: color, opacity: 0.8 }} />
              </div>
              <span className="text-[9px] text-text-tertiary leading-relaxed">{c.detail}</span>
            </div>
          ))}
          <div className="text-[9px] font-mono text-text-muted mt-1 leading-relaxed">
            Recorded: {t.baseline.station.toUpperCase()} @ {(t.baseline.progress * 100).toFixed(0)}%, delay {t.baseline.delay}min ·
            Expected now: km {t.expected.kmAlongRoute} · Live: {t.live.station.toUpperCase()} @ {(t.live.progress * 100).toFixed(0)}%, delay {t.live.delay}min
          </div>
        </div>
      )}
    </div>
  );
};

const ReconItemCard: React.FC<{ item: ReconciliationItem }> = ({ item }) => {
  const resolveItem = useDriftStore(s => s.resolveItem);
  const meta = TYPE_META[item.type];
  const resolved = item.status === 'resolved';
  return (
    <div
      id={`recon-item-${item.id}`}
      className="border rounded-lg p-3 flex flex-col gap-2 transition-opacity"
      style={{
        background: 'var(--color-bg-card)',
        borderColor: resolved ? 'var(--color-border-default)' : `color-mix(in srgb, ${meta.color} 35%, transparent)`,
        opacity: resolved ? 0.55 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
            style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)` }}
          >
            {meta.icon}{meta.label}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary uppercase">{item.field}</span>
        </div>
        <span className="text-[9px] font-mono text-text-muted">{fmtTime(item.detectedAt)}</span>
      </div>

      <span className="text-[12px] font-semibold text-text-primary">{item.entityLabel}</span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[item.sourceA, item.sourceB].map((src, i) => (
          <div key={i} className="rounded-md px-2 py-1.5 border border-border-subtle" style={{ background: 'var(--color-bg-elevated)' }}>
            <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider block">{src.name}</span>
            <span className="text-[10px] font-mono text-text-primary break-words">{src.value}</span>
            {src.timestamp && <span className="text-[8px] font-mono text-text-muted block">@ {fmtTime(src.timestamp)}</span>}
          </div>
        ))}
      </div>

      {item.similarity !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-text-tertiary uppercase shrink-0">Similarity</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
            <div className="h-full rounded-full" style={{ width: `${item.similarity * 100}%`, background: meta.color }} />
          </div>
          <span className="text-[10px] font-mono font-bold" style={{ color: meta.color }}>{Math.round(item.similarity * 100)}%</span>
        </div>
      )}

      <span className="text-[10px] text-text-tertiary leading-relaxed">{item.suggestion}</span>

      {resolved ? (
        <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: 'var(--color-accent-green)' }}>
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Resolved: {item.resolution?.replace('-', ' ')} {item.resolvedAt ? `@ ${fmtTime(item.resolvedAt)}` : ''}</span>
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          {([['accept-live', 'Accept live'], ['keep-baseline', 'Keep baseline'], ['merge', 'Merge']] as const).map(([res, label]) => (
            <button
              key={res}
              onClick={() => resolveItem(item.id, res)}
              className="text-[10px] font-mono font-semibold px-2 sm:px-2.5 py-1 rounded-md border transition-all active:scale-[0.97] cursor-pointer"
              style={{
                borderColor: item.suggestedResolution === res ? meta.color : 'var(--color-border-default)',
                color: item.suggestedResolution === res ? meta.color : 'var(--color-text-secondary)',
                background: item.suggestedResolution === res ? `color-mix(in srgb, ${meta.color} 10%, transparent)` : 'var(--color-bg-elevated)',
              }}
            >
              {label}{item.suggestedResolution === res ? ' ★' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Interactive Live Tester for Judges & Operators */
const ReconSandbox: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('Kanpur Centrall');
  const [kind, setKind] = useState<'station' | 'train'>('station');

  const result = useMemo(() => {
    if (!query.trim()) return null;
    return kind === 'station' ? matchStation(query) : matchTrain(query);
  }, [query, kind]);

  const queuePartialMatch = () => {
    if (!result) return;
    const item = partialMatchItem(kind, result, 'Interactive Live Tester');
    if (item) {
      useDriftStore.setState(s => ({
        reconItems: [item, ...s.reconItems.filter(i => i.id !== item.id)].slice(0, 40),
        timeline: [{ at: new Date().toISOString(), kind: 'partial-match', message: `Sandbox queued for review: "${query}" (${Math.round((item.similarity ?? 0) * 100)}% match)` }, ...s.timeline].slice(0, 60),
      }));
      useDemoStore.getState().addToast({
        type: 'info',
        title: 'Queued to Inbox',
        message: `"${query}" requires operator review (${Math.round((result.similarity || 0) * 100)}% match).`,
      });
    } else {
      useDemoStore.getState().addToast({
        type: 'success',
        title: 'Auto-Resolved',
        message: `"${query}" matched with high confidence (${Math.round((result.similarity || 0) * 100)}%).`,
      });
    }
  };

  const injectWeatherConflict = () => {
    const item = detectWeatherConflict(
      'bsl',
      { rainfall: 0, description: 'Clear sky', temperature: 31, visibility: 10, source: 'live', name: 'Open-Meteo' },
      { rainfall: 64, description: 'Violent rainstorm', temperature: 22, visibility: 1.8, source: 'live', name: 'OpenWeatherMap' }
    );
    if (item) {
      useDriftStore.setState(s => ({
        reconItems: [item, ...s.reconItems.filter(i => i.id !== item.id)].slice(0, 40),
        timeline: [{ at: new Date().toISOString(), kind: 'conflict', message: `Sandbox conflict: Weather at ${item.entityLabel} (Clear vs Heavy Rain)` }, ...s.timeline].slice(0, 60),
      }));
      useDriftStore.getState().computeDriftNow();
      useDemoStore.getState().addToast({
        type: 'warning',
        title: 'Weather Conflict Injected',
        message: 'Open-Meteo (Clear) vs OpenWeather (Heavy Rain 64mm) queued.',
      });
    }
  };

  const injectPositionConflict = () => {
    const item = detectPositionConflict(
      '12137',
      'Punjab Mail',
      { coordinates: [75.8, 21.3], currentStation: 'bsl', source: 'GPS Telemetry Feed (Packet A)', timestamp: new Date().toISOString() },
      { coordinates: [77.4, 23.2], currentStation: 'bpl', source: 'Timetable Position Engine (Packet B)', timestamp: new Date().toISOString() }
    );
    if (item) {
      useDriftStore.setState(s => ({
        reconItems: [item, ...s.reconItems.filter(i => i.id !== item.id)].slice(0, 40),
        timeline: [{ at: new Date().toISOString(), kind: 'conflict', message: `Sandbox conflict: Punjab Mail position mismatch (~180km)` }, ...s.timeline].slice(0, 60),
      }));
      useDriftStore.getState().computeDriftNow();
      useDemoStore.getState().addToast({
        type: 'warning',
        title: 'Position Conflict Injected',
        message: 'GPS Telemetry vs Timetable position divergence queued.',
      });
    }
  };

  const injectDuplicatePacket = () => {
    const ts = new Date().toISOString();
    useDriftStore.getState().ingestFeedEvents([
      { trainId: '12951', timestamp: ts, currentStation: 'rtm', routeProgress: 0.45, speed: 120, source: 'SSE Feed (Stream A)' },
      { trainId: '12951', timestamp: ts, currentStation: 'brc', routeProgress: 0.32, speed: 110, source: 'SSE Feed (Stream B)' },
    ]);
    useDemoStore.getState().addToast({
      type: 'warning',
      title: 'Duplicate Packets Injected',
      message: 'Two conflicting payload events with identical timestamps queued.',
    });
  };

  return (
    <div className="border border-border-default rounded-lg mb-3 overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-bg-elevated/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-accent-purple" />
          <span className="text-[11px] font-mono font-semibold text-text-primary">
            Interactive Reconciler Sandbox · Live Tester
          </span>
          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-accent-purple/10 text-accent-purple border border-accent-purple/20 uppercase">
            Judge Tool
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-text-tertiary">
          <span className="text-[9px] font-mono hidden sm:inline">{open ? 'Hide sandbox' : 'Test matcher & conflicts'}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {open && (
        <div className="p-3 border-t border-border-subtle flex flex-col gap-3">
          {/* Fuzzy Match Tester */}
          <div className="flex flex-col gap-2 p-2.5 rounded-md border border-border-subtle" style={{ background: 'var(--color-bg-elevated)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-accent-purple" /> Jaro-Winkler Similarity Matcher
              </span>
              <div className="flex gap-1">
                {(['station', 'train'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className="text-[9px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer"
                    style={{
                      borderColor: kind === k ? 'var(--color-accent-purple)' : 'var(--color-border-default)',
                      background: kind === k ? 'color-mix(in srgb, var(--color-accent-purple) 15%, transparent)' : 'transparent',
                      color: kind === k ? 'var(--color-accent-purple)' : 'var(--color-text-tertiary)',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type dirty name (e.g. Kanpur Centr, Bhopal Jn, 1295l)..."
                className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded border border-border-default outline-none bg-bg-page text-text-primary focus:border-accent-purple"
              />
              <button
                onClick={queuePartialMatch}
                className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded text-white bg-accent-purple hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                Queue to Inbox
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono text-text-muted">
              <span>Quick tests:</span>
              {['Kanpur Centr', 'Bhopal Jn', '1295l (train)', 'Mumbay Central', 'NDLS'].map(chip => (
                <button
                  key={chip}
                  onClick={() => {
                    if (chip.includes('train')) {
                      setKind('train');
                      setQuery('1295l');
                    } else {
                      setKind('station');
                      setQuery(chip);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded border border-border-subtle hover:border-accent-purple hover:text-text-primary transition-colors cursor-pointer"
                  style={{ background: 'var(--color-bg-page)' }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Match output card */}
            {result && (
              <div className="flex items-center justify-between p-2 rounded border border-border-subtle bg-bg-card text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span
                    className="px-1.5 py-0.5 rounded font-bold uppercase text-[9px]"
                    style={{
                      color: result.status === 'auto' || result.status === 'exact' ? 'var(--color-risk-low)'
                        : result.status === 'review' ? 'var(--color-accent-purple)' : 'var(--color-risk-critical)',
                      background: result.status === 'auto' || result.status === 'exact' ? 'var(--color-risk-low-bg)'
                        : result.status === 'review' ? 'color-mix(in srgb, var(--color-accent-purple) 15%, transparent)' : 'var(--color-risk-critical-bg)',
                    }}
                  >
                    {result.status.toUpperCase()}
                  </span>
                  <span className="text-text-secondary">
                    Best: <strong className="text-text-primary">{result.candidates[0]?.label || 'None'}</strong>
                  </span>
                </div>
                <span className="font-bold" style={{ color: 'var(--color-accent-purple)' }}>
                  {Math.round(result.similarity * 100)}% similarity
                </span>
              </div>
            )}
          </div>

          {/* Quick Scenario Injections */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-accent-blue" /> Instant Scenario Injections (1-Click)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                onClick={injectWeatherConflict}
                className="text-[10px] font-mono p-2 rounded border border-border-default hover:border-accent-red text-left transition-all cursor-pointer hover:bg-bg-elevated/50 active:scale-95"
                style={{ background: 'var(--color-bg-card)' }}
              >
                <div className="font-bold text-accent-red flex items-center gap-1">
                  <CloudRain className="w-3 h-3" /> Weather Conflict
                </div>
                <span className="text-[9px] text-text-muted block mt-0.5">Open-Meteo vs OpenWeather (BSL)</span>
              </button>

              <button
                onClick={injectPositionConflict}
                className="text-[10px] font-mono p-2 rounded border border-border-default hover:border-accent-orange text-left transition-all cursor-pointer hover:bg-bg-elevated/50 active:scale-95"
                style={{ background: 'var(--color-bg-card)' }}
              >
                <div className="font-bold text-accent-orange flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Position Conflict
                </div>
                <span className="text-[9px] text-text-muted block mt-0.5">GPS vs Schedule (180km offset)</span>
              </button>

              <button
                onClick={injectDuplicatePacket}
                className="text-[10px] font-mono p-2 rounded border border-border-default hover:border-accent-amber text-left transition-all cursor-pointer hover:bg-bg-elevated/50 active:scale-95"
                style={{ background: 'var(--color-bg-card)' }}
              >
                <div className="font-bold text-accent-amber flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Duplicate Packets
                </div>
                <span className="text-[9px] text-text-muted block mt-0.5">Conflicting payload streams (12951)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ReconciliationPanel: React.FC = () => {
  const baseline = useDriftStore(s => s.baseline);
  const report = useDriftStore(s => s.driftReport);
  const reconItems = useDriftStore(s => s.reconItems);
  const timeline = useDriftStore(s => s.timeline);
  const corridorHistory = useDriftStore(s => s.corridorHistory);
  const trainHistory = useDriftStore(s => s.trainHistory);
  const duplicatesDropped = useDriftStore(s => s.duplicatesDropped);
  const feedEventsSeen = useDriftStore(s => s.feedEventsSeen);
  const replayActive = useDriftStore(s => s.replayActive);
  const replayStep = useDriftStore(s => s.replayStep);
  const captureBaseline = useDriftStore(s => s.captureBaseline);
  const startReplay = useDriftStore(s => s.startReplay);
  const stopReplay = useDriftStore(s => s.stopReplay);

  const networkHealth = useDemoStore(s => s.networkHealth);

  const openItems = reconItems.filter(i => i.status === 'open');
  const resolvedItems = reconItems.filter(i => i.status === 'resolved').slice(0, 5);
  const corridorColor = report ? CLASS_COLOR[report.corridorClass] : 'var(--color-risk-low)';
  const driftingCount = report ? report.trains.filter(t => t.driftClass !== 'stable').length : 0;
  const isCritical = report ? report.corridorScore >= 70 : false;

  const handoverData = (): HandoverData => ({
    baseline, report, timeline, reconItems, corridorHistory, networkHealth,
  });

  return (
    <div className="flex flex-col h-full bg-bg-page text-text-primary select-none overflow-y-auto pr-0.5 scrollbar-thin">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border-default pb-2.5 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-accent-purple" />
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary font-mono font-medium">
            Reconciliation · Drift Indicator
          </h2>
        </div>
        <span className="text-[10px] font-mono text-text-muted">Round 2</span>
      </div>

      {/* ── Baseline / recorded context ── */}
      <div className="rounded-lg p-3 mb-3 border border-border-default flex items-center justify-between gap-3 flex-wrap shrink-0"
        style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Pin className="w-4 h-4 shrink-0 text-accent-blue" />
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-semibold text-text-primary truncate">
              {baseline ? baseline.name : 'No baseline pinned'}
            </span>
            <span className="text-[9px] font-mono text-text-tertiary uppercase">
              {baseline
                ? `Recorded ${fmtTime(baseline.capturedAt)} · ${baseline.source} · drift measured for ${report ? report.elapsedMinutes.toFixed(0) : 0} min`
                : 'Pin the current situation as the recorded context'}
            </span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <button
            onClick={() => { stopReplay(true); captureBaseline(); }}
            className="text-[10px] font-mono font-semibold px-2.5 py-1.5 rounded-md transition-all active:scale-[0.97] text-white cursor-pointer hover:brightness-110"
            style={{ background: 'var(--color-accent-blue)' }}
          >
            <span className="inline-flex items-center gap-1"><Pin className="w-3 h-3" /> Pin baseline</span>
          </button>
          <button
            onClick={() => (replayActive ? stopReplay() : startReplay())}
            className="text-[10px] font-mono font-semibold px-2.5 py-1.5 rounded-md border border-border-default transition-all active:scale-[0.97] cursor-pointer hover:border-border-hover"
            style={{ background: 'var(--color-bg-elevated)', color: replayActive ? 'var(--color-accent-red)' : 'var(--color-accent-purple)' }}
          >
            <span className="inline-flex items-center gap-1">
              {replayActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span className="hidden sm:inline">{replayActive ? 'Stop replay' : 'Replay scenario'}</span>
              <span className="sm:hidden">{replayActive ? 'Stop' : 'Replay'}</span>
            </span>
          </button>
          <button
            onClick={() => downloadHandoverMarkdown(handoverData())}
            title="Download the shift handover & reconciliation audit as Markdown"
            className="text-[10px] font-mono font-semibold px-2.5 py-1.5 rounded-md border border-border-default transition-all active:scale-[0.97] text-text-secondary hover:text-text-primary cursor-pointer hover:border-border-hover"
            style={{ background: 'var(--color-bg-elevated)' }}
          >
            <span className="inline-flex items-center gap-1"><FileDown className="w-3 h-3" /> <span className="hidden sm:inline">Handover</span> .md</span>
          </button>
          <button
            onClick={() => printHandoverReport(handoverData())}
            title="Open a print-ready handover report (Save as PDF)"
            className="text-[10px] font-mono font-semibold px-2.5 py-1.5 rounded-md border border-border-default transition-all active:scale-[0.97] text-text-secondary hover:text-text-primary cursor-pointer hover:border-border-hover"
            style={{ background: 'var(--color-bg-elevated)' }}
          >
            <span className="inline-flex items-center gap-1"><Printer className="w-3 h-3" /> PDF</span>
          </button>
        </div>
      </div>

      {replayStep && (
        <div className="rounded-md px-3 py-2 mb-3 text-[10px] font-mono flex items-center gap-2 shrink-0"
          style={{ background: 'color-mix(in srgb, var(--color-accent-purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent-purple) 30%, transparent)', color: 'var(--color-accent-purple)' }}>
          <Play className="w-3 h-3 shrink-0" />
          <span className="uppercase tracking-wider">Replay:</span> {replayStep}
        </div>
      )}

      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 shrink-0">
        {[
          { label: 'Corridor drift', value: report ? Math.round(report.corridorScore) : '—', unit: '/100', color: corridorColor },
          { label: 'Trains drifting', value: driftingCount, unit: `of ${report?.trains.length ?? 0}`, color: driftingCount > 0 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)' },
          { label: 'Open items', value: openItems.length, unit: 'inbox', color: openItems.length > 0 ? 'var(--color-accent-red)' : 'var(--color-accent-green)' },
          { label: 'Feed events', value: feedEventsSeen, unit: `${duplicatesDropped} deduped`, color: 'var(--color-accent-blue)' },
        ].map(m => (
          <div
            key={m.label}
            className={`border p-2.5 rounded-lg ${m.label === 'Corridor drift' && isCritical ? 'drift-critical-pulse' : 'border-border-default'}`}
            style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-card)', borderColor: m.label === 'Corridor drift' && isCritical ? 'var(--color-risk-critical)' : undefined }}
          >
            <span className="text-[9px] text-text-tertiary font-mono uppercase block tracking-wider">{m.label}</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-mono font-bold" style={{ color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
              <span className="text-[9px] text-text-tertiary font-mono">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Corridor gauge ── */}
      {report && (
        <div
          className={`rounded-lg p-3 mb-3 border ${isCritical ? 'drift-critical-pulse' : 'border-border-default'}`}
          style={{ background: 'var(--color-bg-card)', borderColor: isCritical ? 'var(--color-risk-critical)' : undefined }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Situation vs recorded context</span>
            <div className="flex items-center gap-2">
              <Sparkline points={corridorHistory.map(p => p.score)} color={corridorColor} />
              <RiskBadge level={CLASS_TO_RISK[report.corridorClass]} />
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--color-bg-elevated)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, report.corridorScore)}%`, background: corridorColor, boxShadow: `0 0 8px ${corridorColor}` }} />
            {/* class thresholds */}
            {[15, 40, 70].map(t => (
              <span key={t} className="absolute top-0 bottom-0 w-px opacity-40" style={{ left: `${t}%`, background: 'var(--color-text-muted)' }} />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[8px] font-mono text-text-muted uppercase tracking-wider">
            <span>stable</span><span>minor</span><span>significant</span><span>critical</span>
          </div>
          <div className="text-[9px] font-mono text-text-muted mt-1.5">
            score = 0.40·schedule + 0.25·position + 0.20·prediction + 0.15·weather · passenger-weighted · deterministic (no LLM)
          </div>
        </div>
      )}

      {/* ── Per-train drift ── */}
      <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Clock className="w-3 h-3" /> Per-train drift {report ? `· ${report.trains.length} monitored` : ''}
      </span>
      <div className="flex flex-col gap-1.5 mb-4">
        {report ? (
          report.trains.map(t => <TrainDriftRow key={t.trainId} t={t} history={trainHistory[t.trainId] || []} />)
        ) : (
          <div className="border border-border-default border-dashed rounded-lg py-6 text-center text-[11px] text-text-tertiary">
            Waiting for the first drift computation…
          </div>
        )}
      </div>

      {/* ── Interactive Reconciler Sandbox (Judges & Operators) ── */}
      <ReconSandbox />

      {/* ── Reconciliation inbox ── */}
      <span id="recon-inbox-section" className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" /> Reconciliation inbox · {openItems.length} open
      </span>
      <div className="flex flex-col gap-2 mb-4">
        {openItems.length === 0 && resolvedItems.length === 0 && (
          <div className="border border-border-default border-dashed rounded-lg py-6 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5" style={{ color: 'var(--color-accent-green)' }} />
            <span className="text-[11px] text-text-tertiary block">No conflicting, duplicate or partially matching records right now.</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Use the Sandbox above or run the Replay scenario to see the reconciler in action.</span>
          </div>
        )}
        {openItems.map(item => <ReconItemCard key={item.id} item={item} />)}
        {resolvedItems.map(item => <ReconItemCard key={item.id} item={item} />)}
      </div>

      {/* ── Drift timeline ── */}
      <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <MapPin className="w-3 h-3" /> Drift timeline
      </span>
      <div className="flex flex-col gap-0 mb-3 border border-border-default rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
        {timeline.length === 0 && (
          <span className="text-[10px] text-text-muted font-mono p-3">Timeline is empty — pin a baseline to start.</span>
        )}
        {timeline.slice(0, 12).map((ev, i) => (
          <div key={`${ev.at}-${i}`} className="flex items-start gap-2 px-3 py-1.5 border-b border-border-subtle last:border-b-0">
            <span className="text-[9px] font-mono text-text-muted shrink-0 mt-px" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(ev.at)}</span>
            <span className="text-[9px] font-mono uppercase shrink-0 mt-px px-1 rounded" style={{
              color: ev.kind === 'resolution' ? 'var(--color-accent-green)'
                : ev.kind === 'baseline' || ev.kind === 'replay' ? 'var(--color-accent-blue)'
                : ev.kind === 'drift' ? 'var(--color-accent-amber)'
                : 'var(--color-accent-red)',
            }}>{ev.kind}</span>
            <span className="text-[10px] text-text-secondary leading-relaxed">{ev.message}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-2 text-[10px] text-text-muted text-center font-mono uppercase tracking-wider flex items-center justify-center gap-1.5">
        <CloudRain className="w-3 h-3" />
        Reconciliation Engine · conflicting / duplicate / partially matching
      </div>
    </div>
  );
};
