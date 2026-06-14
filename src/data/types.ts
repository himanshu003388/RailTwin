export interface TrainRoute {
  trainNo: string;
  trainName: string;
  route: string[];
}

export interface StationData {
  code: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
}

export interface HistoricalDelay {
  trainNo: string;
  month: string;
  weather: string;
  avgDelay: number;
}
