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
    id: "evt-18",
    time: 18,
    type: "copilot",
    payload: {
      thinking: true,
      message: "Analyzing corridor state and running impact simulation..."
    }
  },
  {
    id: "evt-24",
    time: 24,
    type: "copilot",
    payload: {
      thinking: false,
      recommendations: [
        {
          id: "rec-1",
          priority: 1,
          action: "Issue hold order for 12303 at Allahabad Junction (18-min hold resolves platform conflict)",
          impact: "Eliminates 3 platform conflicts"
        },
        {
          id: "rec-2",
          priority: 2,
          action: "Deploy crowd management to Patna platform 5 & 7",
          impact: "Reduces crowd risk from CRITICAL to MODERATE"
        },
        {
          id: "rec-3",
          priority: 3,
          action: "Push passenger alerts via NTES for 12301",
          impact: "Notifies 920 passengers of delay"
        }
      ]
    }
  },
  {
    id: "evt-36",
    time: 36,
    type: "intervention",
    payload: {
      accepted: "hold-12303",
      operator: "CNT-04"
    }
  },
  {
    id: "evt-42",
    time: 42,
    type: "resolved",
    payload: {
      newCascadeDelay: 19,
      conflictsResolved: 3,
      riskReduction: "CRITICAL→MODERATE",
      minutesSaved: 33
    }
  }
];
