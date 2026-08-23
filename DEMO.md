# RailTwin — 3-Minute Presenter Script (Round 2: Reconciliation & Drift)

**Live Demo URL:** [https://rail-twin.vercel.app/?demo=replay](https://rail-twin.vercel.app/?demo=replay)  
**Corridor:** New Delhi Hub · 7 Major Trunk Routes · 36 Junction Stations · 11 IR Zones  
**Theme:** Operations Centre Digital Twin · Pinned Baseline vs Live Reality

---

## ⏱ Timeline Breakdown (180 Seconds)

```
0:00 ──────────────── 0:30 ──────────────── 1:00 ──────────────── 1:45 ──────────────── 2:30 ──────────────── 3:00
  [ 1. The Problem ]     [ 2. The Baseline ]     [ 3. The Drift ]     [ 4. Triage & Resolve ]  [ 5. Handover & AI ]
```

---

### [0:00 – 0:30] Phase 1 · The Operational Reality & Problem
> **Screen:** Live Corridor Map (`Key: 1`) or Drift Monitor (`Key: 7`)

* **What to say:**
  > *"In railway control operations, the single biggest point of failure isn't the train — it's the widening gap between the **recorded plan** the dispatcher is looking at and the **ground reality** happening on the track."*
  > *"Sensors send conflicting weather feeds, satellite transponders drift, OCR scanners misread station codes like 'Kanpur Centrall', and within 45 minutes, a static digital twin becomes dangerously out of date."*
  > *"RailTwin Round 2 introduces **Continuous Telemetry Reconciliation & Closed-Loop Drift Tracking**."*

---

### [0:30 – 1:00] Phase 2 · Pinning the Baseline (Recorded Context)
> **Action:** Click **"Pin baseline"** in the top card of the Drift Monitor (`Key: 7`).

* **What to say:**
  > *"At the start of every controller shift, we snapshot the exact operational context — active train delays, timetable projections, and weather forecasts across all 36 junction stations. This is our **pinned baseline**."*
  > *"From this moment on, RailTwin computes a real-time, explainable drift score across 4 key operational factors: 40% Schedule, 25% Position, 20% Prediction Validity, and 15% Weather."*
  > *"Notice the corridor score is currently **0 / 100 (Stable)**."*

---

### [0:45 – 1:45] Phase 3 · Deterministic Drift Injection & Ghost Marker
> **Action:** Click **"Replay scenario"** (or open via `?demo=replay`).

* **What to say:**
  > *"Let's watch a real 60-second operational disruption unfold:"*
  > 1. **t = 8s:** *"A sudden monsoon storm strikes Bhusaval. Open-Meteo reports torrential rain while OpenWeatherMap reports clear sky. RailTwin automatically catches the weather conflict in the triage inbox."*
  > 2. **t = 18s:** *"Train 12137 Punjab Mail encounters signal hold-ups in the storm cell. Delay jumps +28 minutes."*
  > 3. **t = 30s:** *"Corridor drift crosses into **Significant (orange)**."*
  > 4. **t = 44s:** *"A duplicate NTES packet arrives with conflicting coordinates for Kerala Express — flagged instantly without corrupting the live twin."*
  > 5. **t = 50s:** *"Punjab Mail falls 48 minutes behind. Corridor drift hits **CRITICAL (≥ 70 / 100, Red)** with audio alarm."*
* **Visual highlight:**
  > Switch to Map (`Key: 1`) — show the **Ghost Marker (◌ plan position)** lagging behind the live train with the dashed tether line and click it to show the **Plan vs Live Diff Card**.

---

### [1:45 – 2:30] Phase 4 · Triage Inbox, Live Feed Ingestion & Closed-Loop Resolution (The Climax)
> **Action:** Switch to Drift Monitor (`Key: 7`), open the **Live Telemetry Ingestion Playground**, and show live record parsing or click **"✓ Accept live"** on Punjab Mail.

* **What to say:**
  > *"Unlike passive dashboards, RailTwin offers **active live ingestion & closed-loop resolution**:"*
  > 1. **Live Feed Ingestion Playground:** *"Judges can type any noisy, malformed record into our live sandbox — e.g. `'Kanpur Centrall, 1295l, +35m delay'` — and watch it flow in real time through our Two-Signal Matcher (Jaro-Winkler + Spatial Route Prior) straight into the Triage Inbox."*
  > 2. **Triage Inbox Arbitration:**
  >    - **Partial Match:** *'Kanpur Centrall' resolved via Jaro-Winkler (87% similarity + route boost) to Kanpur Central (`CNB`) — eliminating Round 1's silent NDLS fallback.*
  >    - **Weather Conflict:** *Operator accepts Open-Meteo's live sensor data; network weather updates immediately.*
  >    - **Schedule Conflict:** *Clicking **'Accept live'** re-anchors the recorded plan to Punjab Mail's actual coordinates and delay.*
  > *"Watch what happens right now as we click **Accept live**:"*
  > **[CLICK]** — *Corridor score instantly collapses from 74 (Critical) down to Stable, ghost tether line vanishes from the map, and a 'Drift Mitigated' notification sounds.*

---

### [2:30 – 3:00] Phase 5 · Shift Handover Audit & AI Copilot Explanation
> **Action:** Click **"Handover .md"** or **"PDF"** in the top bar, then click **"AI Suggest"** on an inbox card or **"Explain"** on a train row to invoke Gemini AI Copilot (`Key: 4`).

* **What to say:**
  > *"Every single operator decision is committed to our SQLite audit log. With one click on **'Handover .md'**, the dispatcher downloads a complete, print-ready handover briefing for the incoming shift."*
  > *"If the dispatcher wants advisory assistance on a trade-off, clicking **'AI Suggest'** queries Google Gemini."*
  > *"Gemini is injected with live drift telemetry to analyze root causes and recommend tactical maneuvers — but **the deterministic drift scoring remains 100% pure TypeScript with zero hallucinations**."*

---

## 🎯 Key Judge Takeaways

| Feature | Round 1 Baseline | Round 2 Innovation |
|---|---|---|
| **Unknown Station Handling** | Silently fell back to NDLS (`'ndls'`) | **Two-Signal Matcher (Jaro-Winkler + Spatial Route Prior)** with review triage |
| **Live Ingestion Playground** | Staged inputs only | **Interactive Sandbox** accepting free-form noisy text/CSV strings live |
| **Data Ingestion** | Single trusted feed assumed | **Dual-source weather arbitration** & duplicate stream deduplication |
| **Plan Tracking** | Static schedule | **Continuous 4-factor drift engine** (Schedule, Position, Prediction, Weather) |
| **Map Inspection** | Live train markers only | **Ghost plan markers (◌)** with tether lines & Plan vs Live diff cards |
| **Operator Action** | Read-only viewing | **Closed-loop re-anchoring** that collapses drift in real time |
| **Replay Presentation** | Single fixed speed | **60s Full Replay + ⚡ 18s Fast Replay** mode (`?fast=1`) |
| **Audit & Governance** | Ephemeral state | **SQLite WAL audit log + Shift Handover Markdown & PDF export** |
| **Unit Verification** | Basic tests | **48 / 48 Vitest Unit & Store Integration Tests (100% Passed)** |

