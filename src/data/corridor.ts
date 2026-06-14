export interface Station {
  id: string;
  name: string;
  code: string;
  coordinates: [number, number]; // [lng, lat]
  kmFromOrigin: number;
  platforms: number;
  zone: string;
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';
  activeRainfall?: number;
}

export interface Train {
  id: string;
  name: string;
  type: 'rajdhani' | 'shatabdi' | 'duronto' | 'express' | 'mail';
  currentStation: string;
  nextStation: string;
  scheduledDelay: number;
  predictedDelay: number;
  coordinates: [number, number];
  speed: number;
  passengerCount: number;
  capacity: number;
  routeProgress: number;
  zone: string;
}

export const STATIONS: Record<string, Station> = {
  mmct: { id: 'mmct', name: 'Mumbai Central', code: 'MMCT', coordinates: [72.8318, 19.0656], kmFromOrigin: 0, platforms: 8, zone: 'WR' },
  brc:  { id: 'brc',  name: 'Vadodara', code: 'BRC', coordinates: [73.1810, 22.3087], kmFromOrigin: 392, platforms: 8, zone: 'WR' },
  rtm:  { id: 'rtm',  name: 'Ratlam', code: 'RTM', coordinates: [75.0340, 23.3294], kmFromOrigin: 648, platforms: 6, zone: 'WR' },
  kota: { id: 'kota', name: 'Kota', code: 'KOTA', coordinates: [75.8567, 25.1760], kmFromOrigin: 924, platforms: 6, zone: 'WCR' },
  ndls: { id: 'ndls', name: 'New Delhi', code: 'NDLS', coordinates: [77.2200, 28.6423], kmFromOrigin: 0, platforms: 16, zone: 'NR' },
  mas:  { id: 'mas',  name: 'Chennai Central', code: 'MAS', coordinates: [80.2707, 13.0827], kmFromOrigin: 0, platforms: 12, zone: 'SR' },
  kpd:  { id: 'kpd',  name: 'Katpadi Jn', code: 'KPD', coordinates: [79.1505, 12.9665], kmFromOrigin: 130, platforms: 6, zone: 'SR' },
  jtj:  { id: 'jtj',  name: 'Jolarpettai', code: 'JTJ', coordinates: [78.5720, 12.5610], kmFromOrigin: 214, platforms: 4, zone: 'SR' },
  sbc:  { id: 'sbc',  name: 'KSR Bengaluru', code: 'SBC', coordinates: [77.5665, 12.9757], kmFromOrigin: 0, platforms: 10, zone: 'SWR' },
  mys:  { id: 'mys',  name: 'Mysuru Jn', code: 'MYS', coordinates: [76.6551, 12.3086], kmFromOrigin: 140, platforms: 8, zone: 'SWR' },
  hwh:  { id: 'hwh',  name: 'Howrah Jn', code: 'HWH', coordinates: [88.3410, 22.5841], kmFromOrigin: 0, platforms: 15, zone: 'ER' },
  bls:  { id: 'bls',  name: 'Balasore', code: 'BLS', coordinates: [86.9298, 21.4974], kmFromOrigin: 235, platforms: 5, zone: 'ER' },
  bbs:  { id: 'bbs',  name: 'Bhubaneswar', code: 'BBS', coordinates: [85.8413, 20.2585], kmFromOrigin: 435, platforms: 7, zone: 'ECR' },
  vz:   { id: 'vz',   name: 'Vijayawada Jn', code: 'VZ', coordinates: [80.6172, 16.5173], kmFromOrigin: 886, platforms: 10, zone: 'SCR' },
  dbrg: { id: 'dbrg', name: 'Dibrugarh', code: 'DBRG', coordinates: [95.0031, 27.4629], kmFromOrigin: 0, platforms: 5, zone: 'NFR' },
  ghy:  { id: 'ghy',  name: 'Guwahati', code: 'GHY', coordinates: [91.7454, 26.1808], kmFromOrigin: 500, platforms: 8, zone: 'NFR' },
  njp:  { id: 'njp',  name: 'New Jalpaiguri', code: 'NJP', coordinates: [88.4255, 26.7140], kmFromOrigin: 830, platforms: 7, zone: 'NFR' },
  bju:  { id: 'bju',  name: 'Barauni Jn', code: 'BJU', coordinates: [85.9860, 25.4620], kmFromOrigin: 1118, platforms: 6, zone: 'ECR' },
  mgs:  { id: 'mgs',  name: 'Mughalsarai Jn', code: 'MGS', coordinates: [83.1164, 25.2834], kmFromOrigin: 1275, platforms: 8, zone: 'ECR' },
  puri: { id: 'puri', name: 'Puri', code: 'PURI', coordinates: [85.8312, 19.8135], kmFromOrigin: 0, platforms: 6, zone: 'ECR' },
  kur:  { id: 'kur',  name: 'Khurda Road Jn', code: 'KUR', coordinates: [85.8492, 20.1903], kmFromOrigin: 82, platforms: 5, zone: 'ECR' },
  bhc:  { id: 'bhc',  name: 'Bhadrak', code: 'BHC', coordinates: [86.5193, 21.0586], kmFromOrigin: 198, platforms: 4, zone: 'ECR' },
  gaya: { id: 'gaya', name: 'Gaya Jn', code: 'GAYA', coordinates: [84.9992, 24.7911], kmFromOrigin: 0, platforms: 7, zone: 'ECR' },
  tvc:  { id: 'tvc',  name: 'Thiruvananthapuram Central', code: 'TVC', coordinates: [76.9551, 8.5089], kmFromOrigin: 0, platforms: 8, zone: 'SR' },
  ers:  { id: 'ers',  name: 'Ernakulam Jn', code: 'ERS', coordinates: [76.2853, 9.9795], kmFromOrigin: 220, platforms: 8, zone: 'SR' },
  pgt:  { id: 'pgt',  name: 'Palakkad Jn', code: 'PGT', coordinates: [76.6516, 10.7907], kmFromOrigin: 320, platforms: 6, zone: 'SR' },
  maq:  { id: 'maq',  name: 'Mangaluru Central', code: 'MAQ', coordinates: [74.8452, 12.8694], kmFromOrigin: 622, platforms: 6, zone: 'SR' },
  mrj:  { id: 'mrj',  name: 'Miraj Jn', code: 'MRJ', coordinates: [74.6373, 16.8299], kmFromOrigin: 1100, platforms: 6, zone: 'CR' },
  pune: { id: 'pune', name: 'Pune Jn', code: 'PUNE', coordinates: [73.8730, 18.5289], kmFromOrigin: 1430, platforms: 8, zone: 'CR' },
  csmt: { id: 'csmt', name: 'Chhatrapati Shivaji Maharaj Terminus', code: 'CSMT', coordinates: [72.8353, 18.9400], kmFromOrigin: 0, platforms: 18, zone: 'CR' },
  bsl:  { id: 'bsl',  name: 'Bhusaval Jn', code: 'BSL', coordinates: [75.7775, 21.0469], kmFromOrigin: 501, platforms: 7, zone: 'CR' },
  bpl:  { id: 'bpl',  name: 'Bhopal Jn', code: 'BPL', coordinates: [77.4129, 23.2556], kmFromOrigin: 773, platforms: 8, zone: 'WCR' },
  agc:  { id: 'agc',  name: 'Agra Cantt', code: 'AGC', coordinates: [78.0085, 27.1598], kmFromOrigin: 1201, platforms: 8, zone: 'NCR' },
  jre:  { id: 'jre',  name: 'Jalandhar City', code: 'JRE', coordinates: [75.5505, 31.3290], kmFromOrigin: 1732, platforms: 5, zone: 'NR' },
  fzr:  { id: 'fzr',  name: 'Firozpur Cantt', code: 'FZR', coordinates: [74.6079, 30.9399], kmFromOrigin: 1795, platforms: 4, zone: 'NR' },
  cnb:  { id: 'cnb',  name: 'Kanpur Central', code: 'CNB', coordinates: [80.3510, 26.4542], kmFromOrigin: 881, platforms: 8, zone: 'NCR' },
};

export const ALL_STATIONS = Object.values(STATIONS);

export const TRAIN_ROUTES: Record<string, string[]> = {
  '12951': ['mmct', 'brc', 'rtm', 'kota', 'ndls'],
  '12007': ['mas', 'kpd', 'jtj', 'sbc', 'mys'],
  '12245': ['hwh', 'bls', 'bbs', 'vz', 'mas', 'sbc'],
  '12423': ['dbrg', 'ghy', 'njp', 'bju', 'mgs', 'ndls'],
  '12801': ['puri', 'bbs', 'kur', 'bhc', 'hwh', 'gaya', 'mgs', 'ndls'],
  '12625': ['tvc', 'ers', 'pgt', 'maq', 'mrj', 'pune', 'ndls'],
  '12137': ['csmt', 'bsl', 'bpl', 'agc', 'ndls', 'jre', 'fzr'],
  '12301': ['hwh', 'gaya', 'mgs', 'cnb', 'ndls'],
};

const TRAIN_META: Record<string, { type: Train['type']; speed: number; capacity: number; passengerCount: number; zone: string; startHour: number; startMin: number }> = {
  '12951': { type: 'rajdhani', speed: 130, capacity: 1000, passengerCount: 920, zone: 'WR', startHour: 16, startMin: 35 },
  '12007': { type: 'shatabdi', speed: 110, capacity: 750, passengerCount: 680, zone: 'SR', startHour: 6, startMin: 0 },
  '12245': { type: 'duronto', speed: 130, capacity: 800, passengerCount: 720, zone: 'ER', startHour: 22, startMin: 30 },
  '12423': { type: 'rajdhani', speed: 110, capacity: 850, passengerCount: 780, zone: 'NFR', startHour: 13, startMin: 0 },
  '12801': { type: 'express', speed: 100, capacity: 1400, passengerCount: 1300, zone: 'ECR', startHour: 8, startMin: 0 },
  '12625': { type: 'express', speed: 90, capacity: 1500, passengerCount: 1400, zone: 'SR', startHour: 16, startMin: 45 },
  '12137': { type: 'mail', speed: 85, capacity: 1600, passengerCount: 1480, zone: 'CR', startHour: 20, startMin: 0 },
  '12301': { type: 'rajdhani', speed: 130, capacity: 1000, passengerCount: 920, zone: 'ER', startHour: 16, startMin: 55 },
};

const TRAIN_NAMES: Record<string, string> = {
  '12951': 'Mumbai Rajdhani Express',
  '12007': 'Chennai–Mysuru Shatabdi',
  '12245': 'Howrah–Bengaluru Duronto',
  '12423': 'Dibrugarh–New Delhi Rajdhani',
  '12801': 'Purushottam Express',
  '12625': 'Kerala Express',
  '12137': 'Punjab Mail',
  '12301': 'Howrah–New Delhi Rajdhani',
};

export const TRAINS: Train[] = Object.entries(TRAIN_ROUTES).map(([id, route]) => {
  const meta = TRAIN_META[id] || { type: 'express' as const, speed: 100, capacity: 1000, passengerCount: 900, zone: '' };
  const fromSt = STATIONS[route[0]];
  const toSt = STATIONS[route[1]];
  return {
    id,
    name: TRAIN_NAMES[id] || id,
    type: meta.type,
    currentStation: route[0],
    nextStation: route[1],
    scheduledDelay: 0,
    predictedDelay: 0,
    coordinates: fromSt && toSt ? [(fromSt.coordinates[0] + toSt.coordinates[0]) / 2, (fromSt.coordinates[1] + toSt.coordinates[1]) / 2] as [number, number] : fromSt?.coordinates || [77, 28],
    speed: meta.speed,
    passengerCount: meta.passengerCount,
    capacity: meta.capacity,
    routeProgress: 0.15,
    zone: meta.zone,
  };
});

export function getTrainRoute(trainId: string): Station[] {
  const routeIds = TRAIN_ROUTES[trainId];
  if (!routeIds) return [];
  return routeIds.map(id => STATIONS[id]).filter(Boolean);
}

export function getRouteDistance(trainId: string): number {
  const route = getTrainRoute(trainId);
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineKm(route[i - 1].coordinates, route[i].coordinates);
  }
  return total;
}

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function interpolateTrainPosition(train: Train): [number, number] {
  const route = getTrainRoute(train.id);
  if (route.length < 2) return train.coordinates;
  const fromSt = route.find(s => s.id === train.currentStation);
  const toSt = route.find(s => s.id === train.nextStation);
  if (!fromSt || !toSt) return train.coordinates;
  const t = Math.min(Math.max(train.routeProgress, 0), 1);
  return [
    fromSt.coordinates[0] + (toSt.coordinates[0] - fromSt.coordinates[0]) * t,
    fromSt.coordinates[1] + (toSt.coordinates[1] - fromSt.coordinates[1]) * t,
  ] as [number, number];
}

export function computeLivePositions(): Array<{ id: string; currentStation: string; nextStation: string; routeProgress: number; coordinates: [number, number] }> {
  const now = new Date();
  const istOffset = 5.5 * 3600 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const currentSec = istNow.getUTCHours() * 3600 + istNow.getUTCMinutes() * 60 + istNow.getUTCSeconds();

  return Object.entries(TRAIN_ROUTES).map(([id, route]) => {
    const meta = TRAIN_META[id] || { speed: 100, startHour: 8, startMin: 0 };
    const startSec = meta.startHour * 3600 + meta.startMin * 60;
    const segments: Array<{ from: string; to: string; dist: number; cumDist: number }> = [];
    let totalDist = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const fromSt = STATIONS[route[i]];
      const toSt = STATIONS[route[i + 1]];
      const dist = fromSt && toSt ? haversineKm(fromSt.coordinates, toSt.coordinates) : 100;
      segments.push({ from: route[i], to: route[i + 1], dist, cumDist: totalDist });
      totalDist += dist;
    }

    const durationSec = totalDist / (meta.speed / 3600);
    if (durationSec <= 0) {
      const st = STATIONS[route[0]];
      return { id, currentStation: route[0], nextStation: route[1] || route[0], routeProgress: 0, coordinates: st ? st.coordinates : [78, 22] };
    }

    const elapsed = ((currentSec - startSec) % durationSec + durationSec) % durationSec;
    const progress = Math.min(elapsed / durationSec, 1);
    const travelDist = progress * totalDist;

    for (const seg of segments) {
      if (travelDist >= seg.cumDist && travelDist <= seg.cumDist + seg.dist) {
        const segProgress = seg.dist > 0 ? (travelDist - seg.cumDist) / seg.dist : 0;
        const fromSt = STATIONS[seg.from];
        const toSt = STATIONS[seg.to];
        return {
          id,
          currentStation: seg.from,
          nextStation: seg.to,
          routeProgress: Math.min(Math.max(segProgress, 0), 1),
          coordinates: fromSt && toSt ? [
            fromSt.coordinates[0] + (toSt.coordinates[0] - fromSt.coordinates[0]) * segProgress,
            fromSt.coordinates[1] + (toSt.coordinates[1] - fromSt.coordinates[1]) * segProgress,
          ] as [number, number] : fromSt?.coordinates || [78, 22],
        };
      }
    }

    const lastSeg = segments[segments.length - 1];
    const lastSt = STATIONS[lastSeg.to];
    return { id, currentStation: lastSeg.to, nextStation: lastSeg.to, routeProgress: 1, coordinates: lastSt ? lastSt.coordinates : [78, 22] };
  });
}

export function getSegmentDistance(trainId: string, fromId: string, toId: string): number {
  const route = getTrainRoute(trainId);
  const fromSt = route.find(s => s.id === fromId);
  const toSt = route.find(s => s.id === toId);
  if (!fromSt || !toSt) return 100;
  return haversineKm(fromSt.coordinates, toSt.coordinates);
}
