// Generated from data/track_geometries.json
export interface TrackSegment {
  from: string;
  to: string;
  coords: [number, number][];
  distanceKm: number;
}

export interface TrackGeometry {
  trainNo: string;
  segments: TrackSegment[];
  allCoords: [number, number][];
}

export const TRACK_GEOMETRIES: Record<string, TrackGeometry> = {
  '12951': {
    trainNo: '12951',
    allCoords: [
      [72.8318, 19.0656],
      [73.181, 22.3087],
      [75.034, 23.3294],
      [75.8567, 25.176],
      [77.22, 28.6423],
    ],
    segments: [
      { from: "MMCT", to: "BRC", coords: [[72.8318, 19.0656], [73.181, 22.3087]], distanceKm: 392 },
      { from: "BRC", to: "RTM", coords: [[73.181, 22.3087], [75.034, 23.3294]], distanceKm: 256 },
      { from: "RTM", to: "KOTA", coords: [[75.034, 23.3294], [75.8567, 25.176]], distanceKm: 276 },
      { from: "KOTA", to: "NDLS", coords: [[75.8567, 25.176], [77.22, 28.6423]], distanceKm: 430 },
    ],
  },
  '12007': {
    trainNo: '12007',
    allCoords: [
      [80.2707, 13.0827],
      [79.1505, 12.9665],
      [78.572, 12.561],
      [77.5665, 12.9757],
      [76.6551, 12.3086],
    ],
    segments: [
      { from: "MAS", to: "KPD", coords: [[80.2707, 13.0827], [79.1505, 12.9665]], distanceKm: 130 },
      { from: "KPD", to: "JTJ", coords: [[79.1505, 12.9665], [78.572, 12.561]], distanceKm: 84 },
      { from: "JTJ", to: "SBC", coords: [[78.572, 12.561], [77.5665, 12.9757]], distanceKm: 145 },
      { from: "SBC", to: "MYS", coords: [[77.5665, 12.9757], [76.6551, 12.3086]], distanceKm: 140 },
    ],
  },
  '12245': {
    trainNo: '12245',
    allCoords: [
      [88.341, 22.5841],
      [86.9298, 21.4974],
      [85.8413, 20.2585],
      [80.6172, 16.5173],
      [80.2707, 13.0827],
      [77.5665, 12.9757],
    ],
    segments: [
      { from: "HWH", to: "BLS", coords: [[88.341, 22.5841], [86.9298, 21.4974]], distanceKm: 235 },
      { from: "BLS", to: "BBS", coords: [[86.9298, 21.4974], [85.8413, 20.2585]], distanceKm: 200 },
      { from: "BBS", to: "VZ", coords: [[85.8413, 20.2585], [80.6172, 16.5173]], distanceKm: 451 },
      { from: "VZ", to: "MAS", coords: [[80.6172, 16.5173], [80.2707, 13.0827]], distanceKm: 413 },
      { from: "MAS", to: "SBC", coords: [[80.2707, 13.0827], [77.5665, 12.9757]], distanceKm: 232 },
    ],
  },
  '12423': {
    trainNo: '12423',
    allCoords: [
      [95.0031, 27.4629],
      [91.7454, 26.1808],
      [88.4255, 26.714],
      [85.986, 25.462],
      [83.1164, 25.2834],
      [77.22, 28.6423],
    ],
    segments: [
      { from: "DBRG", to: "GHY", coords: [[95.0031, 27.4629], [91.7454, 26.1808]], distanceKm: 500 },
      { from: "GHY", to: "NJP", coords: [[91.7454, 26.1808], [88.4255, 26.714]], distanceKm: 330 },
      { from: "NJP", to: "BJU", coords: [[88.4255, 26.714], [85.986, 25.462]], distanceKm: 288 },
      { from: "BJU", to: "MGS", coords: [[85.986, 25.462], [83.1164, 25.2834]], distanceKm: 157 },
      { from: "MGS", to: "NDLS", coords: [[83.1164, 25.2834], [77.22, 28.6423]], distanceKm: 600 },
    ],
  },
  '12801': {
    trainNo: '12801',
    allCoords: [
      [85.8312, 19.8135],
      [85.8413, 20.2585],
      [85.8492, 20.1903],
      [86.5193, 21.0586],
      [88.341, 22.5841],
      [84.9992, 24.7911],
      [83.1164, 25.2834],
      [77.22, 28.6423],
    ],
    segments: [
      { from: "PURI", to: "BBS", coords: [[85.8312, 19.8135], [85.8413, 20.2585]], distanceKm: 61 },
      { from: "BBS", to: "KUR", coords: [[85.8413, 20.2585], [85.8492, 20.1903]], distanceKm: 21 },
      { from: "KUR", to: "BHC", coords: [[85.8492, 20.1903], [86.5193, 21.0586]], distanceKm: 116 },
      { from: "BHC", to: "HWH", coords: [[86.5193, 21.0586], [88.341, 22.5841]], distanceKm: 301 },
      { from: "HWH", to: "GAYA", coords: [[88.341, 22.5841], [84.9992, 24.7911]], distanceKm: 383 },
      { from: "GAYA", to: "MGS", coords: [[84.9992, 24.7911], [83.1164, 25.2834]], distanceKm: 91 },
      { from: "MGS", to: "NDLS", coords: [[83.1164, 25.2834], [77.22, 28.6423]], distanceKm: 545 },
    ],
  },
  '12625': {
    trainNo: '12625',
    allCoords: [
      [76.9551, 8.5089],
      [76.2853, 9.9795],
      [76.6516, 10.7907],
      [74.8452, 12.8694],
      [74.6373, 16.8299],
      [73.873, 18.5289],
      [77.22, 28.6423],
    ],
    segments: [
      { from: "TVC", to: "ERS", coords: [[76.9551, 8.5089], [76.2853, 9.9795]], distanceKm: 220 },
      { from: "ERS", to: "PGT", coords: [[76.2853, 9.9795], [76.6516, 10.7907]], distanceKm: 100 },
      { from: "PGT", to: "MAQ", coords: [[76.6516, 10.7907], [74.8452, 12.8694]], distanceKm: 302 },
      { from: "MAQ", to: "MRJ", coords: [[74.8452, 12.8694], [74.6373, 16.8299]], distanceKm: 478 },
      { from: "MRJ", to: "PUNE", coords: [[74.6373, 16.8299], [73.873, 18.5289]], distanceKm: 330 },
      { from: "PUNE", to: "NDLS", coords: [[73.873, 18.5289], [77.22, 28.6423]], distanceKm: 938 },
    ],
  },
  '12137': {
    trainNo: '12137',
    allCoords: [
      [72.8353, 18.94],
      [75.7775, 21.0469],
      [77.4129, 23.2556],
      [78.0085, 27.1598],
      [77.22, 28.6423],
      [75.5505, 31.329],
      [74.6079, 30.9399],
    ],
    segments: [
      { from: "CSMT", to: "BSL", coords: [[72.8353, 18.94], [75.7775, 21.0469]], distanceKm: 501 },
      { from: "BSL", to: "BPL", coords: [[75.7775, 21.0469], [77.4129, 23.2556]], distanceKm: 272 },
      { from: "BPL", to: "AGC", coords: [[77.4129, 23.2556], [78.0085, 27.1598]], distanceKm: 428 },
      { from: "AGC", to: "NDLS", coords: [[78.0085, 27.1598], [77.22, 28.6423]], distanceKm: 131 },
      { from: "NDLS", to: "JRE", coords: [[77.22, 28.6423], [75.5505, 31.329]], distanceKm: 400 },
      { from: "JRE", to: "FZR", coords: [[75.5505, 31.329], [74.6079, 30.9399]], distanceKm: 63 },
    ],
  },
  '12301': {
    trainNo: '12301',
    allCoords: [
      [88.341, 22.5841],
      [84.9992, 24.7911],
      [83.1164, 25.2834],
      [80.351, 26.4542],
      [77.22, 28.6423],
    ],
    segments: [
      { from: "HWH", to: "GAYA", coords: [[88.341, 22.5841], [84.9992, 24.7911]], distanceKm: 465 },
      { from: "GAYA", to: "MGS", coords: [[84.9992, 24.7911], [83.1164, 25.2834]], distanceKm: 90 },
      { from: "MGS", to: "CNB", coords: [[83.1164, 25.2834], [80.351, 26.4542]], distanceKm: 326 },
      { from: "CNB", to: "NDLS", coords: [[80.351, 26.4542], [77.22, 28.6423]], distanceKm: 565 },
    ],
  },
};