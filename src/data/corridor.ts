export interface Station {
  id: string;
  name: string;
  code: string;
  coordinates: [number, number]; // [lng, lat]
  kmFromOrigin: number;
  platforms: number;
  riskLevel?: "low" | "moderate" | "high" | "critical";
  activeRainfall?: number;
}

export interface Corridor {
  id: string;
  name: string;
  totalLength: number;
  stations: Station[];
}

export interface Train {
  id: string;
  name: string;
  type: "rajdhani" | "duronto" | "express" | "mail" | "passenger";
  currentStation: string;
  nextStation: string;
  scheduledDelay: number;
  predictedDelay: number;
  coordinates: [number, number];
  speed: number;
  passengerCount: number;
  capacity: number;
  routeProgress: number;
}

export const CORRIDOR: Corridor = {
  id: "delhi-howrah",
  name: "Delhi–Howrah Corridor",
  totalLength: 1531,
  stations: [
  {
    "id": "ndls",
    "name": "New Delhi",
    "code": "NDLS",
    "coordinates": [77.2200, 28.6423],
    "kmFromOrigin": 0,
    "platforms": 16,
    "riskLevel": "low"
  },
  {
    "id": "cnb",
    "name": "Kanpur Central",
    "code": "CNB",
    "coordinates": [80.3510, 26.4542],
    "kmFromOrigin": 440,
    "platforms": 8,
    "riskLevel": "low"
  },
  {
    "id": "ald",
    "name": "Prayagraj Junction",
    "code": "ALD",
    "coordinates": [81.8288, 25.4462],
    "kmFromOrigin": 630,
    "platforms": 7,
    "riskLevel": "low"
  },
  {
    "id": "pnbe",
    "name": "Patna Junction",
    "code": "PNBE",
    "coordinates": [85.1368, 25.6026],
    "kmFromOrigin": 990,
    "platforms": 10,
    "riskLevel": "low"
  },
  {
    "id": "hwh",
    "name": "Howrah Junction",
    "code": "HWH",
    "coordinates": [88.3410, 22.5841],
    "kmFromOrigin": 1531,
    "platforms": 15,
    "riskLevel": "low"
  }
]
};

export const TRAINS: Train[] = [
  {
    id: '12301',
    name: 'Howrah Rajdhani Express',
    type: 'rajdhani',
    currentStation: 'cnb',
    nextStation: 'ald',
    scheduledDelay: 11,
    predictedDelay: 18,
    coordinates: [80.868, 26.101],
    speed: 130,
    passengerCount: 920,
    capacity: 1000,
    routeProgress: 0.35
  },
  {
    id: '12302',
    name: 'New Delhi Rajdhani',
    type: 'rajdhani',
    currentStation: 'pnbe',
    nextStation: 'ald',
    scheduledDelay: 8,
    predictedDelay: 20,
    coordinates: [84.144, 25.556],
    speed: 130,
    passengerCount: 880,
    capacity: 1000,
    routeProgress: 0.30
  },
  {
    id: '12305',
    name: 'Howrah Rajdhani Express',
    type: 'rajdhani',
    currentStation: 'ndls',
    nextStation: 'cnb',
    scheduledDelay: 13,
    predictedDelay: 8,
    coordinates: [79.412, 27.111],
    speed: 120,
    passengerCount: 850,
    capacity: 900,
    routeProgress: 0.70
  },
  {
    id: '12306',
    name: 'New Delhi Rajdhani',
    type: 'rajdhani',
    currentStation: 'ald',
    nextStation: 'cnb',
    scheduledDelay: 5,
    predictedDelay: 14,
    coordinates: [81.090, 25.950],
    speed: 120,
    passengerCount: 810,
    capacity: 900,
    routeProgress: 0.50
  },
  {
    id: '12259',
    name: 'Sealdah Duronto',
    type: 'duronto',
    currentStation: 'pnbe',
    nextStation: 'hwh',
    scheduledDelay: 1,
    predictedDelay: 12,
    coordinates: [85.778, 24.999],
    speed: 140,
    passengerCount: 720,
    capacity: 800,
    routeProgress: 0.20
  },
  {
    id: '12260',
    name: 'New Delhi Duronto',
    type: 'duronto',
    currentStation: 'cnb',
    nextStation: 'ndls',
    scheduledDelay: 5,
    predictedDelay: 10,
    coordinates: [79.568, 27.001],
    speed: 140,
    passengerCount: 760,
    capacity: 800,
    routeProgress: 0.25
  },
  {
    id: '12381',
    name: 'Poorva Express',
    type: 'express',
    currentStation: 'ald',
    nextStation: 'pnbe',
    scheduledDelay: 10,
    predictedDelay: 22,
    coordinates: [83.814, 25.540],
    speed: 110,
    passengerCount: 1150,
    capacity: 1200,
    routeProgress: 0.60
  },
  {
    id: '12382',
    name: 'Poorva Express',
    type: 'express',
    currentStation: 'hwh',
    nextStation: 'pnbe',
    scheduledDelay: 7,
    predictedDelay: 15,
    coordinates: [86.418, 24.395],
    speed: 110,
    passengerCount: 1080,
    capacity: 1200,
    routeProgress: 0.60
  }
];

export const SORTED_STATIONS = [...CORRIDOR.stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

export const TRAIN_ROUTES: Record<string, string[]> = {
  '12301': ['ndls', 'cnb', 'ald', 'pnbe', 'hwh'],
  '12302': ['hwh', 'pnbe', 'ald', 'cnb', 'ndls'],
  '12305': ['ndls', 'cnb', 'ald', 'pnbe'],
  '12306': ['pnbe', 'ald', 'cnb', 'ndls'],
  '12259': ['ndls', 'cnb', 'pnbe', 'hwh'],
  '12260': ['hwh', 'pnbe', 'cnb', 'ndls'],
  '12381': ['ndls', 'cnb', 'ald', 'pnbe', 'hwh'],
  '12382': ['hwh', 'pnbe', 'ald', 'cnb', 'ndls'],
};

export function interpolateTrainPosition(train: Train, stationsList?: Station[]): [number, number] {
  const list = stationsList || SORTED_STATIONS;
  const fromStation = list.find(s => s.id === train.currentStation);
  const toStation = list.find(s => s.id === train.nextStation);
  if (!fromStation || !toStation) return train.coordinates;
  const t = Math.min(Math.max(train.routeProgress, 0), 1);
  return [
    fromStation.coordinates[0] + (toStation.coordinates[0] - fromStation.coordinates[0]) * t,
    fromStation.coordinates[1] + (toStation.coordinates[1] - fromStation.coordinates[1]) * t
  ];
}

export function getCorridorDistance(fromId: string, toId: string, stationsList?: Station[]): number {
  const list = stationsList || SORTED_STATIONS;
  const from = list.find(s => s.id === fromId);
  const to = list.find(s => s.id === toId);
  if (!from || !to) return 0;
  return Math.abs(to.kmFromOrigin - from.kmFromOrigin);
}
