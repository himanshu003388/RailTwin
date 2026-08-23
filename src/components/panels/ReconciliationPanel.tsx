import React, { useState, useMemo } from 'react';
import { useDriftStore } from '../../stores/driftStore';
import { RiskBadge } from '../ui/RiskBadge';
import {
  GitCompare, Pin, Play, Square, AlertTriangle, CheckCircle2, Clock, Copy, CloudRain, MapPin, FileDown, Printer,
  FlaskConical, Wand2, ChevronDown, ChevronUp, Sparkles, Bot, Users, Activity,
} from 'lucide-react';
import { useDemoStore } from '../../stores/demoStore';
import { downloadHandoverMarkdown, printHandoverReport, type HandoverData } from '../../lib/export-report';
import {
  makeReconItem,
  matchStation,
  matchTrain,
  partialMatchItem,
  detectWeatherConflict,
  detectPositionConflict,
} from '../../lib/reconciler';
import type { DriftClass, ReconciliationItem, TrainDrift } from '../../data/types';

function getBaseUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

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

/** Operational Architecture & Drift Rationale Guide */
const OperationalArchitectureGuide: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-bg-card border border-accent-purple/30 rounded-lg p-3 mb-3 shrink-0 transition-all duration-200"
      style={{
        boxShadow: '0 0 12px rgba(168,85,247,0.10)',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(59,130,246,0.03) 100%)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
        className="w-full flex items-center justify-between gap-2 cursor-pointer select-none outline-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3 text-accent-purple" />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono font-bold text-text-primary">
                Operational Architecture: Multi-Source Digital Twin Drift & Closed-Loop Reconciliation
              </span>
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/15 text-accent-purple border border-purple-500/30 uppercase">
                Corridor Telemetry Protocol
              </span>
            </div>
            <span className="text-[9px] font-mono text-text-tertiary">
              Why digital twins diverge from field reality and how RailTwin closes the reconciliation loop
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-text-tertiary hover:text-text-primary text-[10px] font-mono">
          <span>{open ? 'Hide details' : 'View Architecture & Rationale'}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex flex-col gap-3 animate-fade-in text-[10px] leading-relaxed">
          {/* Section 1: The Core Operational Problem */}
          <div className="flex flex-col gap-1">
            <span className="font-mono font-bold text-text-secondary uppercase text-[9px] tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-accent-amber" /> 1. Digital Twin vs Field Reality Divergence
            </span>
            <p className="text-text-tertiary">
              In high-density corridors (like Mumbai–Delhi), field reality frequently drifts from planned master timetables due to monsoonal speed restrictions, signal halts, and cascade delays. If a Digital Twin operates on an outdated or static baseline, automated dispatching and AI recommendations become dangerously decoupled from actual train positions and track occupancies.
            </p>
          </div>

          {/* Section 2: 4D Mathematical Drift Engine */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono font-bold text-text-secondary uppercase text-[9px] tracking-wider flex items-center gap-1">
              <GitCompare className="w-3 h-3 text-accent-blue" /> 2. 4-Dimensional Deterministic Drift Formulation
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="p-2 rounded bg-bg-elevated border border-border-subtle flex flex-col gap-0.5">
                <span className="font-mono font-bold text-accent-blue text-[9px]">40% Schedule Drift</span>
                <span className="text-text-tertiary text-[9px]">Calculates live delay change Δmin vs scheduled baseline ceiling (45m max).</span>
              </div>
              <div className="p-2 rounded bg-bg-elevated border border-border-subtle flex flex-col gap-0.5">
                <span className="font-mono font-bold text-accent-green text-[9px]">25% Position Drift</span>
                <span className="text-text-tertiary text-[9px]">Measures spatial deviation Δkm between actual train coordinates and planned kinematics.</span>
              </div>
              <div className="p-2 rounded bg-bg-elevated border border-border-subtle flex flex-col gap-0.5">
                <span className="font-mono font-bold text-accent-purple text-[9px]">20% ML Model Validity</span>
                <span className="text-text-tertiary text-[9px]">Audits if original ML Ridge delay assumptions (weather/speed) still hold or collapsed.</span>
              </div>
              <div className="p-2 rounded bg-bg-elevated border border-border-subtle flex flex-col gap-0.5">
                <span className="font-mono font-bold text-accent-amber text-[9px]">15% Micro-Climate Drift</span>
                <span className="text-text-tertiary text-[9px]">Tracks live Doppler radar rainfall and fog visibility shifts at upcoming stations.</span>
              </div>
            </div>
          </div>

          {/* Section 3: Passenger Weighting & Closed-Loop Reconciliation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded bg-bg-elevated/70 border border-border-subtle flex flex-col gap-1">
              <span className="font-mono font-bold text-text-secondary text-[9px] uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-accent-purple" /> Passenger-Exposure Weighting
              </span>
              <p className="text-text-tertiary text-[9px]">
                Corridor drift is weighted by passenger capacity (<code className="font-mono text-text-secondary">∑(Score_i × Pass_i) / ∑Pass_i</code>). A 30m delay on a 1,600-passenger Rajdhani carries higher operational severity than an empty rake.
              </p>
            </div>

            <div className="p-2.5 rounded bg-bg-elevated/70 border border-border-subtle flex flex-col gap-1">
              <span className="font-mono font-bold text-text-secondary text-[9px] uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-accent-green" /> Closed-Loop Resolution Action
              </span>
              <p className="text-text-tertiary text-[9px]">
                Operators resolve conflicting feeds in 1-click (<strong className="text-text-secondary">Accept live</strong>, <strong className="text-text-secondary">Keep baseline</strong>, or <strong className="text-text-secondary">Merge ★</strong>). Resolving an item re-anchors the Digital Twin and writes to an immutable handover audit ledger.
              </p>
            </div>
          </div>

          {/* Section 4: System Capabilities */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">System Capabilities:</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-accent-blue border border-blue-500/20 text-[8px] font-mono">
              ✓ 100% Deterministic (Zero Hallucination)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-accent-green border border-green-500/20 text-[8px] font-mono">
              ✓ Dual-Source Auto-Deduplication
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-accent-purple border border-purple-500/20 text-[8px] font-mono">
              ✓ Interactive Sandbox & Fuzzy Matcher
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-accent-amber border border-amber-500/20 text-[8px] font-mono">
              ✓ Shift Handover Markdown & PDF Export
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const TrainDriftRow: React.FC<{ t: TrainDrift; history: number[] }> = ({ t, history }) => {
  const [open, setOpen] = useState(false);
  const color = CLASS_COLOR[t.driftClass];
  const isDrifted = t.driftClass === 'significant' || t.driftClass === 'critical' || t.driftClass === 'minor';
  const worst = [...t.components].sort((a, b) => b.weighted - a.weighted)[0];
  const liveDelay = t.live.delay || 0;
  const baseDelay = t.baseline.delay || 0;
  const deltaDelay = Math.abs(liveDelay - baseDelay);

  let operationalSummary = 'Nominal on-time schedule';
  if (t.score >= 40) {
    operationalSummary = `Significant drift (+${liveDelay}m) · ${worst.label}: ${worst.detail}`;
  } else if (t.score >= 15) {
    operationalSummary = `Minor drift (+${liveDelay}m) · ${worst.detail}`;
  } else if (liveDelay > 0) {
    operationalSummary = `Low drift (+${liveDelay}m schedule)`;
  }

  const handleReconcile = (e: React.MouseEvent) => {
    e.stopPropagation();
    const state = useDriftStore.getState();
    let item = state.reconItems.find(i => i.status === 'open' && i.entity === t.trainId);
    if (!item) {
      item = makeReconItem({
        type: 'conflict',
        entity: t.trainId,
        entityLabel: `${t.trainId} · ${t.trainName}`,
        field: 'schedule',
        sourceA: { name: 'Recorded Plan', value: `Delay ${t.baseline.delay}m @ ${t.baseline.station.toUpperCase()}` },
        sourceB: { name: 'Live Reality', value: `Delay ${t.live.delay}m @ ${t.live.station.toUpperCase()}` },
        severity: t.driftClass === 'critical' ? 'critical' : 'high',
        suggestedResolution: 'accept-live',
        suggestion: `Schedule drift has reached ${Math.round(t.score)}/100 (${t.driftClass}). Suggest accepting live reality to re-anchor baseline projection.`,
      });
      useDriftStore.setState(s => ({
        reconItems: [item!, ...s.reconItems],
        timeline: [{
          at: new Date().toISOString(),
          kind: 'conflict' as const,
          message: `Escalated to inbox: ${t.trainId} ${t.trainName} schedule drift (${Math.round(t.score)}/100)`,
        }, ...s.timeline].slice(0, 60),
      }));
    }
    setTimeout(() => {
      const el = document.getElementById(`recon-item-${item!.id}`) || document.getElementById('recon-inbox-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        el.classList.add('drift-critical-pulse');
        setTimeout(() => el.classList.remove('drift-critical-pulse'), 2500);
      }
    }, 50);
  };

  const handleExplainDrift = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = `Why has train ${t.trainId} ${t.trainName} drifted to ${Math.round(t.score)}/100 and what should I do?`;
    useDemoStore.setState({ activePanel: 'copilot', copilotPrefill: prompt } as any);
  };

  return (
    <div className="border border-border-default rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-elevated/50 transition-colors cursor-pointer outline-none"
      >
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-bold text-text-primary truncate">{t.trainId} · {t.trainName}</span>
            {liveDelay > 0 && (
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-accent-amber border border-amber-500/20">
                +{liveDelay}m live
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono text-text-tertiary uppercase truncate max-w-[280px] sm:max-w-[420px]">
            {t.live.station.toUpperCase()} → {t.live.nextStation.toUpperCase()} · Δdelay {deltaDelay}min · {operationalSummary}
          </span>
        </div>
        <Sparkline points={history} color={color} />
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleExplainDrift}
            className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border border-border-default hover:border-accent-purple text-text-tertiary hover:text-accent-purple transition-all cursor-pointer flex items-center gap-1"
            title="Ask AI Copilot to explain this drift"
          >
            <Bot className="w-2.5 h-2.5 text-accent-purple" />
            <span className="hidden sm:inline">Explain</span>
          </button>
          {isDrifted && (
            <button
              onClick={handleReconcile}
              className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border transition-all active:scale-95 cursor-pointer hover:brightness-110"
              style={{
                borderColor: color,
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
                color,
              }}
              title="Escalate and reconcile this drifted train in the inbox"
            >
              Reconcile
            </button>
          )}
          <span className="text-sm font-mono font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(t.score)}
          </span>
          <RiskBadge level={CLASS_TO_RISK[t.driftClass]} />
        </div>
      </div>
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
        timeline: [{ at: new Date().toISOString(), kind: 'partial-match' as const, message: `Sandbox queued for review: "${query}" (${Math.round((item.similarity ?? 0) * 100)}% match)` }, ...s.timeline].slice(0, 60),
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
        timeline: [{ at: new Date().toISOString(), kind: 'conflict' as const, message: `Sandbox conflict: Weather at ${item.entityLabel} (Clear vs Heavy Rain)` }, ...s.timeline].slice(0, 60),
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
        timeline: [{ at: new Date().toISOString(), kind: 'conflict' as const, message: `Sandbox conflict: Punjab Mail position mismatch (~180km)` }, ...s.timeline].slice(0, 60),
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
            Diagnostic Tool
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
  const trains = useDemoStore(s => s.trains);
  const weatherAlert = useDemoStore(s => s.weatherAlert);
  const stationRisks = useDemoStore(s => s.stationRisks);

  const openItems = reconItems.filter(i => i.status === 'open');
  const resolvedItems = reconItems.filter(i => i.status === 'resolved').slice(0, 5);
  const corridorColor = report ? CLASS_COLOR[report.corridorClass] : 'var(--color-risk-low)';
  const driftingCount = report ? report.trains.filter(t => t.driftClass !== 'stable').length : 0;
  const isCritical = report ? report.corridorScore >= 70 : false;

  const handoverData = (): HandoverData => ({
    baseline,
    report,
    timeline,
    reconItems,
    corridorHistory,
    networkHealth,
    trains,
    weatherAlert,
    stationRisks,
  });

  const [recentBaselines, setRecentBaselines] = useState<Array<{ baseline_id: string; name: string; source: string; captured_at: string }>>([]);

  React.useEffect(() => {
    fetch(`${getBaseUrl()}api/baseline`)
      .then(r => r.json())
      .then(d => {
        if (d?.recent && Array.isArray(d.recent)) {
          setRecentBaselines(d.recent);
        }
      })
      .catch(() => {});
  }, [baseline?.id]);

  const handleSelectEarlierBaseline = async (id: string) => {
    if (!id || id === baseline?.id) return;
    try {
      const res = await fetch(`${getBaseUrl()}api/baseline?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.baseline) {
          useDriftStore.setState({ baseline: data.baseline });
          useDriftStore.getState().computeDriftNow();
          useDemoStore.getState().addToast({
            type: 'info',
            title: 'Baseline Loaded',
            message: `Switched reference baseline to "${data.baseline.name}".`,
          });
        }
      }
    } catch {}
  };

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
        <span className="text-[10px] font-mono text-text-muted">Active Monitoring</span>
      </div>

      {/* ── Operational Architecture & Drift Rationale ── */}
      <OperationalArchitectureGuide />

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
            {recentBaselines.length > 1 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">History:</span>
                <select
                  value={baseline?.id || ''}
                  onChange={e => handleSelectEarlierBaseline(e.target.value)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border-subtle bg-bg-elevated text-text-secondary outline-none cursor-pointer hover:border-accent-blue"
                  title="Switch to an earlier recorded baseline snapshot"
                >
                  {recentBaselines.map(b => (
                    <option key={b.baseline_id} value={b.baseline_id}>
                      {b.name} ({new Date(b.captured_at).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' })})
                    </option>
                  ))}
                </select>
              </div>
            )}
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
