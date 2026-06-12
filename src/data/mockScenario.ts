export interface DemoEvent {
  id: string;
  time: number; // in seconds from demo start
  type: "weather" | "prediction" | "simulation" | "copilot" | "intervention" | "resolved";
  payload: any;
}

export const DEMO_TIMELINE: DemoEvent[] = [
  {
    id: "evt-0",
    time: 0,
    type: "weather",
    payload: {
      station: "pnbe",
      rainfall: 72,
      description: "Heavy monsoon rainfall detected near Patna (72mm/hr)"
    }
  },
  {
    id: "evt-4",
    time: 4,
    type: "prediction",
    payload: {
      trainId: "12301",
      delayMinutes: 38,
      affectedStation: "pnbe",
      confidence: 0.87
    }
  },
  {
    id: "evt-8",
    time: 8,
    type: "prediction",
    payload: {
      trainId: "12303",
      delayMinutes: 22,
      affectedStation: "pnbe",
      confidence: 0.81
    }
  },
  {
    id: "evt-12",
    time: 12,
    type: "simulation",
    payload: {
      conflictsDetected: 3,
      cascadeDelay: 52,
      passengersAffected: 19000,
      stationsImpacted: ["pnbe", "dhn", "hwh"]
    }
  },
  {
    id: "evt-16",
    time: 16,
    type: "copilot",
    payload: {
      thinking: true,
      message: "Analyzing corridor impact from monsoon disruption..."
    }
  }
];
