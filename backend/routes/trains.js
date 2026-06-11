import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stationsPath = path.resolve(__dirname, '../../data/station_data.json');
const routesPath = path.resolve(__dirname, '../../data/train_routes.json');
const delaysPath = path.resolve(__dirname, '../../data/historical_delays.json');

function readRawStations() {
  return JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
}

function readRawRoutes() {
  return JSON.parse(fs.readFileSync(routesPath, 'utf8'));
}

function readRawDelays() {
  return JSON.parse(fs.readFileSync(delaysPath, 'utf8'));
}

// Global lookup maps for simulation enrichment
const kmFromOriginMap = {
  'NDLS': 0,
  'CNB': 440,
  'PRYJ': 630,
  'ALD': 630,
  'BSB': 760,
  'PNBE': 990,
  'DHN': 1270,
  'HWH': 1531,
  'LKO': 510
};

const platformsMap = {
  'NDLS': 16,
  'CNB': 8,
  'PRYJ': 7,
  'ALD': 7,
  'BSB': 9,
  'PNBE': 10,
  'DHN': 6,
  'HWH': 15,
  'LKO': 8
};

const nameToIdMap = {
  'new delhi': 'ndls',
  'kanpur central': 'cnb',
  'kanpur': 'cnb',
  'prayagraj junction': 'ald',
  'allahabad': 'ald',
  'prayagraj': 'ald',
  'varanasi junction': 'bsb',
  'varanasi': 'bsb',
  'patna junction': 'pnbe',
  'patna': 'pnbe',
  'dhanbad junction': 'dhn',
  'dhanbad': 'dhn',
  'howrah junction': 'hwh',
  'howrah': 'hwh',
  'lucknow charbagh': 'lko',
  'lucknow': 'lko'
};

function nameToId(name) {
  if (!name) return 'ndls';
  return nameToIdMap[name.toLowerCase()] || 'ndls';
}

function getEnrichedStations() {
  const stations = readRawStations();
  return stations.map(st => {
    const code = st.code.toUpperCase();
    return {
      id: code.toLowerCase() === 'pryj' ? 'ald' : code.toLowerCase(),
      name: st.name,
      code: code === 'PRYJ' ? 'ALD' : code,
      coordinates: [st.lng, st.lat],
      kmFromOrigin: kmFromOriginMap[code] || 0,
      platforms: platformsMap[code] || 4
    };
  });
}

const trainConfig = {
  '12301': { type: 'rajdhani', speed: 110, startHour: 16, startMin: 55, capacity: 1000, passengerCount: 920 },
  '12303': { type: 'express', speed: 95, startHour: 16, startMin: 10, capacity: 1200, passengerCount: 1150 },
  '12305': { type: 'rajdhani', speed: 120, startHour: 17, startMin: 15, capacity: 900, passengerCount: 850 },
  '13005': { type: 'mail', speed: 75, startHour: 13, startMin: 0, capacity: 1500, passengerCount: 1400 },
  '12273': { type: 'express', speed: 115, startHour: 12, startMin: 40, capacity: 800, passengerCount: 720 },
  '12002': { type: 'express', speed: 100, startHour: 6, startMin: 0, capacity: 800, passengerCount: 710 }
};

function getSyntheticStopsForRoute(trainNo, routeStations) {
  const config = trainConfig[trainNo] || { type: 'express', speed: 80, startHour: 12, startMin: 0 };
  
  let currentKm = 0;
  let currentTime = new Date();
  currentTime.setHours(config.startHour, config.startMin, 0, 0);

  const stops = [];

  for (let i = 0; i < routeStations.length; i++) {
    const stationName = routeStations[i];
    const stationId = nameToId(stationName);
    const code = stationId.toUpperCase() === 'ALD' ? 'PRYJ' : stationId.toUpperCase();
    
    const nextKm = kmFromOriginMap[code] || currentKm;
    const distance = nextKm - currentKm;
    
    if (i > 0 && distance > 0) {
      const travelHours = distance / config.speed;
      const travelMinutes = Math.round(travelHours * 60);
      currentTime.setMinutes(currentTime.getMinutes() + travelMinutes);
    }
    
    const scheduledArrival = i === 0 ? '' : currentTime.toTimeString().substring(0, 5);
    
    if (i > 0 && i < routeStations.length - 1) {
      currentTime.setMinutes(currentTime.getMinutes() + 10); // 10 min dwell
    }
    
    const scheduledDeparture = i === routeStations.length - 1 ? '' : currentTime.toTimeString().substring(0, 5);
    
    stops.push({
      stationCode: code === 'PRYJ' ? 'ALD' : code,
      km: nextKm,
      scheduledArrival: scheduledArrival || scheduledDeparture,
      scheduledDeparture: scheduledDeparture || scheduledArrival
    });

    currentKm = nextKm;
  }

  return stops;
}

// GET /api/trains/stations - Expose all stations dynamically
router.get('/stations', (req, res) => {
  try {
    const stations = getEnrichedStations();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trains - Expose all active trains dynamically
router.get('/', (req, res) => {
  try {
    const routes = readRawRoutes();

    // Active position coordinates and telemetry progress for simulation
    const activeStates = {
      '12301': { currentStation: 'pnbe', nextStation: 'dhn', routeProgress: 0.3, coordinates: [85.78, 24.69] },
      '12303': { currentStation: 'ald', nextStation: 'bsb', routeProgress: 0.4, coordinates: [82.40, 25.38] },
      '12305': { currentStation: 'cnb', nextStation: 'ald', routeProgress: 0.5, coordinates: [81.09, 25.95] },
      '13005': { currentStation: 'dhn', nextStation: 'hwh', routeProgress: 0.2, coordinates: [87.38, 23.18] },
      '12273': { currentStation: 'ndls', nextStation: 'cnb', routeProgress: 0.6, coordinates: [78.78, 27.54] },
      '12002': { currentStation: 'cnb', nextStation: 'lko', routeProgress: 0.5, coordinates: [80.63, 26.64] }
    };

    const trains = routes.map(route => {
      const config = trainConfig[route.trainNo] || { type: 'express', capacity: 1000, passengerCount: 900, speed: 90 };
      const active = activeStates[route.trainNo] || {
        currentStation: nameToId(route.route[0]) || 'ndls',
        nextStation: nameToId(route.route[1]) || 'cnb',
        routeProgress: 0.0,
        coordinates: [77.2217, 28.6419]
      };

      return {
        id: route.trainNo,
        name: route.trainName,
        type: config.type,
        capacity: config.capacity,
        passengerCount: config.passengerCount,
        speed: config.speed,
        currentStation: active.currentStation,
        nextStation: active.nextStation,
        routeProgress: active.routeProgress,
        coordinates: active.coordinates,
        predictedDelay: 0
      };
    });

    res.json(trains);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trains/:id/schedule - Expose train timetable details merged with actual performance logs
router.get('/:id/schedule', (req, res) => {
  try {
    const routes = readRawRoutes();
    const delays = readRawDelays();
    const trainId = req.params.id;

    const route = routes.find(r => r.trainNo === trainId);
    if (!route) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const stops = getSyntheticStopsForRoute(route.trainNo, route.route);

    // Helper function to add delay minutes to time string (HH:MM format)
    const addMinutesToTime = (timeStr, mins) => {
      if (!timeStr || !mins) return timeStr;
      const [h, m] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m + mins, 0, 0);
      return date.toTimeString().substring(0, 5);
    };

    const mergedStops = stops.map(stop => {
      const delayRecord = delays.find(d => d.trainNo === trainId);
      const delay = delayRecord ? delayRecord.avgDelay : 0;

      return {
        stationCode: stop.stationCode,
        scheduledArrival: stop.scheduledArrival,
        scheduledDeparture: stop.scheduledDeparture,
        actualArrival: addMinutesToTime(stop.scheduledArrival, delay),
        actualDeparture: addMinutesToTime(stop.scheduledDeparture, delay),
        km: stop.km
      };
    });

    res.json({
      trainId: route.trainNo,
      stops: mergedStops
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trains/simulation/cascade - Run cascade delay propagation using historical delay averages
router.post('/simulation/cascade', (req, res) => {
  try {
    const { stationId, scenario } = req.body;
    if (!stationId || !scenario) {
      return res.status(400).json({ error: 'Missing stationId or scenario parameters.' });
    }

    const stations = getEnrichedStations();
    const routes = readRawRoutes();
    const delays = readRawDelays();

    const sortedStations = [...stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);
    const triggerIndex = sortedStations.findIndex(s => s.id === stationId);

    if (triggerIndex === -1) {
      return res.status(404).json({ error: 'Station not found in network.' });
    }

    // Filter trains currently heading towards or past trigger station
    const downstreamStationIds = sortedStations.slice(triggerIndex).map(s => s.id);
    const activeStates = {
      '12301': { currentStation: 'pnbe', nextStation: 'dhn' },
      '12303': { currentStation: 'ald', nextStation: 'bsb' },
      '12305': { currentStation: 'cnb', nextStation: 'ald' },
      '13005': { currentStation: 'dhn', nextStation: 'hwh' },
      '12273': { currentStation: 'ndls', nextStation: 'cnb' },
      '12002': { currentStation: 'cnb', nextStation: 'lko' }
    };

    const affectedTrains = routes.filter(route => {
      const active = activeStates[route.trainNo] || { currentStation: '', nextStation: '' };
      return downstreamStationIds.includes(active.currentStation) || downstreamStationIds.includes(active.nextStation);
    });

    // Look up historical weather matching delay averages if available
    const scenarioWeatherMap = {
      'rainfall': 'Rain',
      'fog': 'Fog'
    };
    const targetWeather = scenarioWeatherMap[scenario] || 'Rain';

    const matchingHistoricalDelay = delays.find(
      d => d.weather.toLowerCase() === targetWeather.toLowerCase()
    );

    let delayMultiplier = 20;
    let conflictWeight = 1.5;

    if (matchingHistoricalDelay) {
      delayMultiplier = matchingHistoricalDelay.avgDelay;
      conflictWeight = matchingHistoricalDelay.avgDelay > 30 ? 3.0 :
                       matchingHistoricalDelay.avgDelay > 15 ? 1.8 : 1.2;
    } else {
      if (scenario === 'rainfall') {
        delayMultiplier = 35;
        conflictWeight = 2.0;
      } else if (scenario === 'signal_failure') {
        delayMultiplier = 50;
        conflictWeight = 2.5;
      } else if (scenario === 'track_damage') {
        delayMultiplier = 80;
        conflictWeight = 4.0;
      } else if (scenario === 'fog') {
        delayMultiplier = 25;
        conflictWeight = 1.2;
      }
    }

    const affectedCount = affectedTrains.length;
    const totalTrains = routes.length;

    const cascadeDelay = Math.round(delayMultiplier * (0.6 + (affectedCount / totalTrains) * 0.8));
    const conflictsDetected = Math.max(1, Math.round(conflictWeight * (affectedCount / totalTrains) * 3));
    
    // Sum capacity of affected trains
    const passengersAffected = affectedTrains.reduce((sum, t) => {
      const config = trainConfig[t.trainNo] || { passengerCount: 800 };
      return sum + config.passengerCount;
    }, 0);

    const stationsImpacted = sortedStations
      .slice(triggerIndex, triggerIndex + Math.min(3, sortedStations.length - triggerIndex))
      .map(s => s.id);

    res.json({
      conflictsDetected,
      cascadeDelay,
      passengersAffected,
      stationsImpacted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
