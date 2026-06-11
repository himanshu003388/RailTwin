export interface StationData {
  id: string;
  name: string;
  code: string;
  coordinates: [number, number]; // [lng, lat]
  kmFromOrigin: number;
  platforms: number;
}

export interface RouteStop {
  stationCode: string;
  km: number;
  scheduledArrival: string;
  scheduledDeparture: string;
}

export interface TrainRoute {
  trainId: string;
  name: string;
  type: 'rajdhani' | 'mail' | 'express' | 'passenger';
  capacity: number;
  passengerCount: number;
  speed: number;
  stops: RouteStop[];
}

export interface WeatherContext {
  precipitation: number; // mm/hr
  windSpeed: number; // km/h
  visibility: number; // meters
}

export interface HistoricalDelay {
  id: string;
  trainId: string;
  stationCode: string;
  delayMinutes: number;
  scheduledTime: string;
  actualTime: string;
  cause: 'rainfall' | 'signal_failure' | 'track_damage' | 'fog' | 'other';
  severity: 'minor' | 'moderate' | 'severe';
  weatherContext?: WeatherContext;
}
