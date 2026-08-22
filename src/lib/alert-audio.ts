// ─────────────────────────────────────────────────────────────
// Alert audio — tiny Web Audio synthesizer for control-room
// chimes. No audio assets, no dependencies; honours the user's
// audioEnabled toggle (checked by callers).
// ─────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch { return null; }
  }
  // Browsers suspend contexts created before a user gesture
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, gainPeak = 0.12, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Urgent two-tone descending alarm — a train entered CRITICAL drift. */
export function playCriticalDriftAlert() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 880, t, 0.18, 0.14, 'square');
  tone(ac, 660, t + 0.22, 0.18, 0.14, 'square');
  tone(ac, 880, t + 0.5, 0.18, 0.12, 'square');
  tone(ac, 660, t + 0.72, 0.26, 0.12, 'square');
}

/** Soft rising chime — drift mitigated / conflict resolved. */
export function playResolvedChime() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 523.25, t, 0.15, 0.09);        // C5
  tone(ac, 659.25, t + 0.12, 0.15, 0.09); // E5
  tone(ac, 783.99, t + 0.24, 0.3, 0.09);  // G5
}
