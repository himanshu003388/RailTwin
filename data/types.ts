export interface StationData {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface TrainRoute {
  trainNo: string;
  trainName: string;
  route: string[];
}

export interface HistoricalDelay {
  trainNo: string;
  avgDelay: number;
  month: string;
  weather: string;
}
