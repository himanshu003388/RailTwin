# RailTwin AI — Operations Center

A **Predictive Digital Twin dashboard** for Indian Railway operations, modeling the Delhi-Howrah Corridor (1,531 km). Built as a hackathon prototype demonstrating monsoon weather disruption simulation, train delay prediction, cascade analysis, and AI-powered copilot recommendations.

## Quick Start

### Prerequisites

- **Node.js** >= 22.12
- **npm** (comes with Node)

### Install & Run

```sh
# Clone the repo
git clone https://github.com/himanshu003388/RailTwin.git
cd RailTwin

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app opens at **http://localhost:4321/RailTwin**

### Build for Production

```sh
npm run build        # Output to ./dist/
npm run preview      # Preview the build locally
```

## How to Use

### Running the Demo

1. Open the app — you'll see the **Map View** with 7 stations and 5 trains on the Delhi-Howrah corridor
2. Press **SPACE** or click **"Run Demo Scenario"** in the sidebar to start the 50-second simulation
3. Watch as weather disruptions trigger, delays cascade, AI copilot analyzes, and mitigations resolve

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Map View |
| `2` | Train Delays |
| `3` | Simulation |
| `4` | AI Copilot |
| `5` | What-If Lab |
| `6` | System Health |
| `SPACE` | Start/Stop demo |
| `M` | Toggle audio alerts |

### Panel Descriptions

| Panel | What It Shows |
|-------|---------------|
| **Map View** | Interactive corridor map with live train positions, station risk indicators, weather overlay, and route lines |
| **Train Delays** | Recharts area chart showing predicted delay accumulation per train over time |
| **Simulation** | Cascade simulation engine with conflict detection, impact metrics, and AI mitigation recommendations |
| **AI Copilot** | Chat interface with automated analysis and reasoning traces for corridor events |
| **What-If Lab** | Interactive scenario builder — select a station and disruption type (rainfall, signal failure, track damage, fog) to see projected cascade impact |
| **System Health** | Real-time network efficiency, on-time performance, and platform utilization gauges |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Astro](https://astro.build) v6 + [React](https://react.dev) 19 |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Maps | [MapLibre GL](https://maplibre.org/) v4 (CDN) |
| Charts | [Recharts](https://recharts.org/) v3 |
| Icons | [Lucide React](https://lucide.dev/) |
| Fonts | Geist Sans + Geist Mono |

## Project Structure

```
src/
├── pages/
│   └── index.astro          # Single page entry point
├── layouts/
│   └── DashboardLayout.astro # Shell: loading overlay, CDN scripts, global UI
├── components/
│   ├── layout/              # Dashboard chrome (TopBar, Sidebar, MainPanel, RightSidebar)
│   ├── map/                 # CorridorMap (MapLibre GL with train markers & layers)
│   ├── panels/              # Detail panels (DelayChart, Simulation, WhatIf, Health, StationRisk)
│   ├── copilot/             # AI CopilotChat
│   └── ui/                  # Shared UI (AlertBanner, Toast, TimelineScrubber, RiskBadge, etc.)
├── stores/
│   └── demoStore.ts         # Zustand store — all app state & demo logic
├── data/
│   ├── corridor.ts          # Station/train definitions & helpers
│   └── mockScenario.ts      # Demo timeline events
└── styles/
    └── global.css           # Tailwind theme tokens, animations, scrollbars
```

## Deployment

The project is configured for deployment on **Vercel** (SSR rendering via `@astrojs/vercel`) and **GitHub Pages**:

- **Vercel Production Live Link**: [https://rail-twin.vercel.app/](https://rail-twin.vercel.app/)
- **GitHub Pages Sandbox**: [https://himanshu003388.github.io/RailTwin/](https://himanshu003388.github.io/RailTwin/)

## Data Sources

RailTwin AI is grounded in real-world Indian Railway data:
1. **Indian Railways Dataset (Kaggle)**: Source for the database of 36 major junction stations, latitude/longitude coordinates, track geometries, and core train route configurations.
2. **NTES (National Train Enquiry System) & IRCTC**: Used for baseline schedule verification and validation of delay-propagation behaviors.
3. **OpenWeatherMap & Open-Meteo**: Powering the dynamic live weather alerts and meteorology-based delay scaling.
4. **Ridge Regression delay model**: Trained on 448 historical delay profiles across Indian Railways corridors.

## License

Hackathon prototype — not for production use.
