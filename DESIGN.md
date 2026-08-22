# RailTwin AI — Design System & Architectural Guidelines

> **Project:** RailTwin AI — Operations Centre Digital Twin for Indian Railways  
> **Framework:** Astro 6 + React 19 + Tailwind CSS 4 + MapLibre GL  
> **Design Philosophy:** Dense, High-Signal, Mission-Critical Industrial Control Room  

---

## 1. Design Vision & Philosophy

RailTwin AI is designed to look and feel like a modern, top-tier **Railway Operations Control Center (OCC)**. It balances rich visual aesthetics (subtle glassmorphism, refined dark/light modes, live glowing indicators, crisp tabular typography) with high-density operational telemetry.

### Core Tenets:
1. **High Information Density with Clear Visual Hierarchy**: Operators need to see network health, active disruptions, live drift, and conflict queues at a glance without scrolling paralysis.
2. **Deterministic & Explainable AI/ML**: AI Copilot explanations and Drift scores must always be grounded in deterministic formulas (0–100) and clear feature attributions—never hallucinatory or opaque.
3. **Closed-Loop Actionability**: Every anomaly or drift indicator provides direct, consequence-bearing actions (e.g. *Accept Live*, *Keep Baseline*, *Merge*) that mutate the twin state and audit log immediately.
4. **Resilient Aesthetics**: Cohesive in both Deep Charcoal Dark Mode (`#0a0f1d`) and Crisp Slate Light Mode (`#f8fafc`).

---

## 2. Color Palette & Semantic Tokens

### Backgrounds & Surfaces
| Token | Dark Mode Value | Light Mode Value | Usage |
|---|---|---|---|
| `--color-bg-page` | `#080c14` | `#f1f5f9` | Canvas background |
| `--color-bg-card` | `#0e1422` | `#ffffff` | Panel containers, cards |
| `--color-bg-elevated` | `#151d30` | `#f8fafc` | Buttons, inputs, pills |
| `--color-bg-sunken` | `#060910` | `#e2e8f0` | Inset badges, code blocks |

### Borders & Dividers
| Token | Dark Mode Value | Light Mode Value | Usage |
|---|---|---|---|
| `--color-border-default` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.10)` | Card borders, dividers |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.04)` | `rgba(0, 0, 0, 0.05)` | Inner table lines |
| `--color-border-hover` | `rgba(59, 130, 246, 0.40)` | `rgba(37, 99, 235, 0.40)` | Focus & active hover states |

### Semantic Risk & Drift Colors
| Severity / Class | Accent Color | Background Tint | Border Tint |
|---|---|---|---|
| **Stable / Low Risk** | `#22c55e` (Green) | `rgba(34, 197, 94, 0.10)` | `rgba(34, 197, 94, 0.25)` |
| **Minor / Moderate** | `#f59e0b` (Amber) | `rgba(245, 158, 11, 0.10)` | `rgba(245, 158, 11, 0.25)` |
| **Significant / High** | `#f97316` (Orange) | `rgba(249, 115, 22, 0.10)` | `rgba(249, 115, 22, 0.25)` |
| **Critical Drift** | `#ef4444` (Crimson) | `rgba(239, 68, 68, 0.12)` | `rgba(239, 68, 68, 0.35)` |

### Domain Accents
- **RailTwin Primary Blue:** `#3b82f6` (Interactive elements, corridor path, primary telemetry)
- **AI & Reconciliation Purple:** `#a855f7` (Copilot chat, Jaro-Winkler fuzzy matches, drift indicators)
- **Telemetry Cyan:** `#06b6d4` (Speed gauges, station platforms, weather HUD)

---

## 3. Typography & Numerics

- **Primary Sans Font:** `Geist Sans`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`  
  *Usage:* Headers, button labels, descriptions, and conversational AI bubbles.
- **Monospace Font:** `Geist Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`  
  *Usage:* Station codes (e.g. `NDLS`, `CNB`), train numbers (`12951`), timestamps, live coordinates, drift scores, mathematical formulas.
- **Tabular Numerics:** Always enforce `font-variant-numeric: tabular-nums;` on scores, timers, and delay deltas to prevent layout jitter during real-time re-renders.

---

## 4. Component Patterns & Guidelines

### 4.1 Drift Indicator & Reconciliation Panel
- **Baseline Banner:** Visual anchor displaying captured timestamp, duration elapsed, and snapshot source (`auto` / `manual` / `replay`).
- **Corridor Gauge:** 0–100 progress bar segmented into 4 classification zones with glowing pill markers and real-time SVG sparklines.
- **Per-Train Accordion:** Compact rows showing train ID, route endpoints, delay delta, sparkline, and expandable 4-component breakdown bars (Schedule, Position, Prediction, Weather).
- **Reconciliation Inbox:** Distinct card badges for `[CONFLICT]`, `[DUPLICATE]`, and `[PARTIAL MATCH]` with side-by-side Source A vs Source B comparison, similarity percentage bars, and 1-click resolution triggers.

### 4.2 Map Visualizations (MapLibre GL)
- **Live vs Ghost Overlay:** Active trains render with solid route glow and pulsed markers. Drifted trains render a companion dashed "Ghost Marker" indicating expected plan coordinates with a connecting tether line.
- **Diff Popup Inspector:** Clicking either the ghost or live marker opens a comparative Plan vs. Live HUD showing $\Delta\text{km}$, $\Delta\text{min}$, and weather changes.

### 4.3 AI Copilot Integration
- **Context Injection:** System prompt dynamically includes the current corridor score, top drifting trains, and pending inbox conflicts.
- **Quick Inquiry Chips:** Interactive pills above the chat prompt allow 1-click execution of mission-critical questions (e.g., *"Explain Punjab Mail drift"*, *"Recommend mitigation strategy"*).

---

## 5. Accessibility & Motion Standards

1. **Reduced Motion**: All pulse animations (`drift-critical-pulse`, `animate-ping`) degrade gracefully if `prefers-reduced-motion: reduce` is detected.
2. **Auditory Feedback**: Web Audio API alarms (critical two-tone warning and resolution chime) are strictly opt-in and bound to the `M` keyboard shortcut and TopBar toggle.
3. **Contrast Compliance**: Text-to-background contrast ratios strictly meet WCAG AA standards (minimum 4.5:1 for body copy and 3.0:1 for monospace telemetry).
