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
  type: "rajdhani" | "mail" | "express" | "passenger";
  currentStation: string;
  nextStation: string;
  scheduledDelay: number; // in minutes
  predictedDelay: number; // in minutes
  coordinates: [number, number]; // [lng, lat]
  speed: number; // km/h
  passengerCount: number;
  capacity: number;
}

export const CORRIDOR: Corridor = {
  id: "delhi-howrah",
  name: "Delhi–Howrah Corridor",
  totalLength: 1531,
  stations: [
    { id: "ndls", name: "New Delhi", code: "NDLS", coordinates: [77.2217, 28.6419], kmFromOrigin: 0, platforms: 16, riskLevel: "low" },
    { id: "cnb", name: "Kanpur Central", code: "CNB", coordinates: [80.3514, 26.4536], kmFromOrigin: 440, platforms: 8, riskLevel: "low" },
    { id: "alld", name: "Prayagraj Junction", code: "ALD", coordinates: [81.8284, 25.4497], kmFromOrigin: 630, platforms: 7, riskLevel: "low" },
    { id: "bsb", name: "Varanasi Junction", code: "BSB", coordinates: [82.9739, 25.3263], kmFromOrigin: 760, platforms: 9, riskLevel: "low" },
    { id: "pnbe", name: "Patna Junction", code: "PNBE", coordinates: [85.1376, 25.6023], kmFromOrigin: 990, platforms: 10, riskLevel: "low" },
    { id: "dhn", name: "Dhanbad Junction", code: "DHN", coordinates: [86.4278, 23.7925], kmFromOrigin: 1270, platforms: 6, riskLevel: "low" },
    { id: "hwh", name: "Howrah Junction", code: "HWH", coordinates: [88.3416, 22.5849], kmFromOrigin: 1531, platforms: 15, riskLevel: "low" },
    { id: "ald", name: "Allahabad Junction", code: "ALD", coordinates: [81.8290, 25.4490], kmFromOrigin: 632, platforms: 7, riskLevel: "low" }
  ]
};

export const TRAINS: Train[] = [
  {
    id: "12301",
    name: "Howrah Rajdhani Express",
    type: "rajdhani",
    currentStation: "pnbe",
    nextStation: "dhn",
    scheduledDelay: 0,
    predictedDelay: 0,
    coordinates: [85.78, 24.69],
    speed: 110,
    passengerCount: 920,
    capacity: 1000
  },
  {
    id: "12303",
    name: "Poorva Express",
    type: "express",
    currentStation: "ald",
    nextStation: "bsb",
    scheduledDelay: 0,
    predictedDelay: 0,
    coordinates: [82.40, 25.38],
    speed: 95,
    passengerCount: 1150,
    capacity: 1200
  },
  {
    id: "12305",
    name: "Rajendra Nagar Patna Rajdhani",
    type: "rajdhani",
    currentStation: "cnb",
    nextStation: "ald",
    scheduledDelay: 0,
    predictedDelay: 0,
    coordinates: [81.09, 25.95],
    speed: 120,
    passengerCount: 850,
    capacity: 900
  },
  {
    id: "13005",
    name: "Amritsar Mail",
    type: "mail",
    currentStation: "dhn",
    nextStation: "hwh",
    scheduledDelay: 0,
    predictedDelay: 0,
    coordinates: [87.38, 23.18],
    speed: 75,
    passengerCount: 1400,
    capacity: 1500
  },
  {
    id: "12273",
    name: "Howrah Duronto",
    type: "express",
    currentStation: "ndls",
    nextStation: "cnb",
    scheduledDelay: 0,
    predictedDelay: 0,
    coordinates: [78.78, 27.54],
    speed: 115,
    passengerCount: 720,
    capacity: 800
  }
];
