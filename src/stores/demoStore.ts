import { create } from 'zustand';
import { CORRIDOR, TRAINS, type Train, type Station } from '../data/corridor';
import { DEMO_TIMELINE, type DemoEvent } from '../data/mockScenario';

export interface CopilotMessage {
  id: string;
  sender: 'system' | 'user' | 'copilot';
  message: string;
  timestamp: Date;
}

export interface Recommendation {
  id: string;
  priority: number;
  action: string;
  impact: string;
  accepted?: boolean;
}

export interface StationRisk {
  crowdRisk: 'low' | 'moderate' | 'high' | 'critical';
  delayRisk: 'low' | 'moderate' | 'high' | 'critical';
  platformConflicts: number;
}

export interface Toast {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'ai';
  title: string;
  message: string;
}

export interface DemoState {
  demoRunning: boolean;
  demoTime: number; // seconds elapsed since start
  weatherAlert: null | { station: string; rainfall: number; description: string };
  trains: Train[];
  stationRisks: Record<string, StationRisk>;
  predictions: Array<{
    trainId: string;
    delayMinutes: number;
    affectedStation: string;
    confidence: number;
    timestamp: number;
  }>;
  simulation: null | {
    conflictsDetected: number;
    cascadeDelay: number;
    passengersAffected: number;
    stationsImpacted: string[];
    running: boolean;
  };
  copilot: {
    thinking: boolean;
    messages: CopilotMessage[];
    recommendations: Recommendation[];
  };
  intervention: null | { accepted: string; operator: string };
  resolved: null | {
    newCascadeDelay: number;
    conflictsResolved: number;
    riskReduction: string;
    minutesSaved: number;
  };
  activePanel: 'map' | 'delays' | 'simulation' | 'copilot';
  toasts: Toast[];

  // Actions
  startDemo: () => void;
  resetDemo: () => void;
  setActivePanel: (panel: 'map' | 'delays' | 'simulation' | 'copilot') => void;
  acceptRecommendation: (id: string) => void;
  tickDemo: (second: number) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// Global timers references
let timerInterval: any = null;
let eventTimeouts: any[] = [];

const createInitialStationRisks = (): Record<string, StationRisk> => {
  const risks: Record<string, StationRisk> = {};
  CORRIDOR.stations.forEach(station => {
    risks[station.id] = {
      crowdRisk: 'low',
      delayRisk: 'low',
      platformConflicts: 0
    };
  });
  return risks;
};

const initialStoreState = {
  demoRunning: false,
  demoTime: 0,
  weatherAlert: null,
  trains: JSON.parse(JSON.stringify(TRAINS)), // deep copy initial trains
  stationRisks: createInitialStationRisks(),
  predictions: [],
  simulation: null,
  copilot: {
    thinking: false,
    messages: [
      {
        id: 'init-msg',
        sender: 'system',
        message: 'RailTwin Operations Center Initialized. Awaiting weather data...',
        timestamp: new Date()
      }
    ],
    recommendations: []
  },
  intervention: null,
  resolved: null,
  activePanel: 'map' as const,
  toasts: []
};

export const useDemoStore = create<DemoState>((set, get) => ({
  ...initialStoreState,

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };
    set(state => ({ toasts: [...state.toasts, newToast] }));
  },

  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },

  startDemo: () => {
    // Clear any existing timers
    if (timerInterval) clearInterval(timerInterval);
    eventTimeouts.forEach(clearTimeout);
    eventTimeouts = [];

    // Reset state before starting
    set({
      ...initialStoreState,
      trains: JSON.parse(JSON.stringify(TRAINS)),
      stationRisks: createInitialStationRisks(),
      demoRunning: true,
      activePanel: 'map'
    });

    // Schedule all timeline events
    DEMO_TIMELINE.forEach(event => {
      const timeout = setTimeout(() => {
        if (get().demoRunning) {
          get().tickDemo(event.time);
        }
      }, event.time * 1000);
      eventTimeouts.push(timeout);
    });

    // Start tick interval
    timerInterval = setInterval(() => {
      if (get().demoRunning) {
        const nextTime = get().demoTime + 1;
        set({ demoTime: nextTime });

        // Automated Panel Switches & States
        if (nextTime === 8) {
          set({ activePanel: 'delays' });
        } else if (nextTime === 12) {
          set({ activePanel: 'simulation' });
        } else if (nextTime === 18) {
          set(state => ({
            activePanel: 'simulation',
            copilot: {
              ...state.copilot,
              thinking: true
            }
          }));
        } else if (nextTime === 24) {
          set({ activePanel: 'copilot' });
        } else if (nextTime === 30) {
          set({ activePanel: 'simulation' });
        } else if (nextTime === 50) {
          set({ activePanel: 'map', demoRunning: false });
          if (timerInterval) clearInterval(timerInterval);
        }
      }
    }, 1000);
  },

  resetDemo: () => {
    if (timerInterval) clearInterval(timerInterval);
    eventTimeouts.forEach(clearTimeout);
    eventTimeouts = [];
    set({
      ...initialStoreState,
      trains: JSON.parse(JSON.stringify(TRAINS)),
      stationRisks: createInitialStationRisks()
    });
  },

  setActivePanel: (panel) => {
    set({ activePanel: panel });
  },

  acceptRecommendation: (id) => {
    // Mark recommendation as accepted in store
    const updatedRecommendations = get().copilot.recommendations.map(r =>
      r.id === id ? { ...r, accepted: true } : r
    );

    set(state => ({
      copilot: {
        ...state.copilot,
        recommendations: updatedRecommendations,
        messages: [
          ...state.copilot.messages,
          {
            id: `user-msg-${Date.now()}`,
            sender: 'user',
            message: `Accepted recommendation: ${state.copilot.recommendations.find(r => r.id === id)?.action}`,
            timestamp: new Date()
          },
          {
            id: `copilot-apply-${Date.now()}`,
            sender: 'copilot',
            message: 'Sending hold instruction to Allahabad Junction (ALD). Recalculating signal schedules...',
            timestamp: new Date()
          }
        ]
      },
      intervention: {
        accepted: id,
        operator: 'OP-01'
      }
    }));

    // Trigger resolved sequence after 1.5s
    const timeout = setTimeout(() => {
      if (!get().demoRunning) return;
      if (get().resolved) return;

      const resolvedTrains = get().trains.map(t => {
        if (t.id === '12303') {
          return {
            ...t,
            currentStation: 'ald',
            predictedDelay: 18,
            coordinates: [81.8290, 25.4490] as [number, number] // center at Allahabad Junction
          };
        }
        if (t.id === '12301') {
          return { ...t, predictedDelay: 19 };
        }
        return t;
      });

      // Fire success toast for manual override completion
      get().addToast({
        type: 'success',
        title: 'Mitigation Successful',
        message: 'Intervention applied. 33 minutes saved.'
      });

      set(state => ({
        stationRisks: {
          ...state.stationRisks,
          pnbe: {
            crowdRisk: 'moderate',
            delayRisk: 'moderate',
            platformConflicts: 0
          }
        },
        trains: resolvedTrains,
        simulation: state.simulation
          ? {
              ...state.simulation,
              cascadeDelay: 19,
              conflictsDetected: 0
            }
          : null,
        resolved: {
          newCascadeDelay: 19,
          conflictsResolved: 3,
          riskReduction: 'CRITICAL→MODERATE',
          minutesSaved: 33
        },
        copilot: {
          ...state.copilot,
          messages: [
            ...state.copilot.messages,
            {
              id: `copilot-res-${Date.now()}`,
              sender: 'copilot',
              message: 'Intervention successful: Poorva Express hold processed. Grid conflicts resolved. Cascade delay minimized to 19 minutes.',
              timestamp: new Date()
            }
          ]
        }
      }));
    }, 1500);
    eventTimeouts.push(timeout);
  },

  tickDemo: (second) => {
    // Find the timeline event at this time
    const event = DEMO_TIMELINE.find(e => e.time === second);
    if (!event) return;

    const { type, payload } = event;

    switch (type) {
      case 'weather':
        get().addToast({
          type: 'warning',
          title: 'Disruption Detected',
          message: 'Heavy rainfall detected near Patna'
        });

        set(state => ({
          weatherAlert: payload,
          stationRisks: {
            ...state.stationRisks,
            [payload.station]: {
              crowdRisk: 'moderate',
              delayRisk: 'moderate',
              platformConflicts: 0
            }
          },
          copilot: {
            ...state.copilot,
            messages: [
              ...state.copilot.messages,
              {
                id: `weather-msg-${Date.now()}`,
                sender: 'system',
                message: `Alert: Rainfall at ${payload.station.toUpperCase()} is ${payload.rainfall}mm/hr. Tracking localized delays.`,
                timestamp: new Date()
              }
            ]
          }
        }));
        break;

      case 'prediction':
        set(state => {
          const updatedTrains = state.trains.map(t =>
            t.id === payload.trainId ? { ...t, predictedDelay: payload.delayMinutes } : t
          );
          const currentRisk = state.stationRisks[payload.affectedStation];
          const trainName = updatedTrains.find(t => t.id === payload.trainId)?.name || `Train ${payload.trainId}`;

          get().addToast({
            type: 'warning',
            title: 'Delay Accumulation',
            message: `${payload.trainId} Howrah Rajdhani: +${payload.delayMinutes} min predicted delay`
          });

          return {
            trains: updatedTrains,
            predictions: [
              ...state.predictions,
              {
                trainId: payload.trainId,
                delayMinutes: payload.delayMinutes,
                affectedStation: payload.affectedStation,
                confidence: payload.confidence,
                timestamp: second
              }
            ],
            stationRisks: {
              ...state.stationRisks,
              [payload.affectedStation]: {
                ...currentRisk,
                delayRisk: 'high'
              }
            },
            copilot: {
              ...state.copilot,
              messages: [
                ...state.copilot.messages,
                {
                  id: `pred-msg-${Date.now()}`,
                  sender: 'system',
                  message: `Predictive Alert: Train ${payload.trainId} expected to accumulate ${payload.delayMinutes} min delay at ${payload.affectedStation.toUpperCase()} (Confidence: ${Math.round(payload.confidence * 100)}%).`,
                  timestamp: new Date()
                }
              ]
            }
          };
        });
        break;

      case 'simulation':
        get().addToast({
          type: 'error',
          title: 'Simulation Complete',
          message: 'Simulation complete: 3 platform conflicts, 19K passengers at risk'
        });

        set(state => ({
          simulation: {
            conflictsDetected: payload.conflictsDetected,
            cascadeDelay: payload.cascadeDelay,
            passengersAffected: payload.passengersAffected,
            stationsImpacted: payload.stationsImpacted,
            running: true
          }
        }));

        const simulationTimeout = setTimeout(() => {
          if (!get().demoRunning) return;
          set(state => ({
            simulation: state.simulation ? { ...state.simulation, running: false } : null,
            stationRisks: {
              ...state.stationRisks,
              pnbe: {
                crowdRisk: 'critical',
                delayRisk: 'critical',
                platformConflicts: 3
              }
            },
            copilot: {
              ...state.copilot,
              messages: [
                ...state.copilot.messages,
                {
                  id: `sim-msg-${Date.now()}`,
                  sender: 'system',
                  message: `Simulation Complete: 3 conflicts detected at PNBE. Projected cascade delay is ${payload.cascadeDelay} mins.`,
                  timestamp: new Date()
                }
              ]
            }
          }));
        }, 500);
        eventTimeouts.push(simulationTimeout);
        break;

      case 'copilot':
        if (payload.thinking) {
          get().addToast({
            type: 'ai',
            title: 'Copilot Active',
            message: 'Copilot analyzing corridor impact...'
          });

          set(state => ({
            copilot: {
              ...state.copilot,
              thinking: true,
              messages: [
                ...state.copilot.messages,
                {
                  id: `cop-think-${Date.now()}`,
                  sender: 'copilot',
                  message: payload.message,
                  timestamp: new Date()
                }
              ]
            }
          }));
        } else {
          get().addToast({
            type: 'ai',
            title: 'Mitigations Available',
            message: '3 recommendations ready — review in Simulation panel'
          });

          set(state => ({
            copilot: {
              ...state.copilot,
              thinking: false,
              recommendations: payload.recommendations.map((rec: any) => ({ ...rec, accepted: false })),
              messages: [
                ...state.copilot.messages,
                {
                  id: `cop-rec-${Date.now()}`,
                  sender: 'copilot',
                  message: 'Analysis complete. Dispatching mitigation options. Operational hold at ALD recommended.',
                  timestamp: new Date()
                }
              ]
            }
          }));
        }
        break;

      case 'intervention':
        // If not already manually accepted, auto-apply it to simulate operations
        if (!get().intervention) {
          get().acceptRecommendation('rec-1');
        }
        break;

      case 'resolved':
        if (get().resolved) return;

        get().addToast({
          type: 'success',
          title: 'Disruption Resolved',
          message: 'Intervention applied. 33 minutes saved.'
        });

        const resolvedTrains = get().trains.map(t => {
          if (t.id === '12303') {
            return {
              ...t,
              currentStation: 'ald',
              predictedDelay: 18,
              coordinates: [81.8290, 25.4490] as [number, number]
            };
          }
          if (t.id === '12301') {
            return { ...t, predictedDelay: 19 };
          }
          return t;
        });

        set(state => ({
          stationRisks: {
            ...state.stationRisks,
            pnbe: {
              crowdRisk: 'moderate',
              delayRisk: 'moderate',
              platformConflicts: 0
            }
          },
          trains: resolvedTrains,
          simulation: state.simulation
            ? {
                ...state.simulation,
                cascadeDelay: payload.newCascadeDelay,
                conflictsDetected: 0
              }
            : null,
          resolved: {
            newCascadeDelay: payload.newCascadeDelay,
            conflictsResolved: payload.conflictsResolved,
            riskReduction: payload.riskReduction,
            minutesSaved: payload.minutesSaved
          },
          copilot: {
            ...state.copilot,
            messages: [
              ...state.copilot.messages,
              {
                id: `cop-res-auto-${Date.now()}`,
                sender: 'copilot',
                message: `Conflict resolution auto-applied. New cascade delay is ${payload.newCascadeDelay} mins.`,
                timestamp: new Date()
              }
            ]
          }
        }));
        break;
    }
  }
}));

export const initDemoStore = () => {
  useDemoStore.getState().resetDemo();
};
