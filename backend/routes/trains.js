import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to file location to support multi-context executions
const stationsPath = path.resolve(__dirname, '../../data/station_data.json');
const routesPath = path.resolve(__dirname, '../../data/train_routes.json');
const delaysPath = path.resolve(__dirname, '../../data/historical_delays.json');

function readStations() {
  return JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
}

function readRoutes() {
  return JSON.parse(fs.readFileSync(routesPath, 'utf8'));
}

function readDelays() {
  return JSON.parse(fs.readFileSync(delaysPath, 'utf8'));
}

// GET /api/trains/stations - Expose all stations dynamically
router.get('/stations', (req, res) => {
  try {
    const stations = readStations();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trains - Expose all active trains dynamically
router.get('/', (req, res) => {
  try {
    const routes = readRoutes();

    // Active position coordinates and telemetry progress for simulation
    const activeStates = {
      '12301': { currentStation: 'pnbe', nextStation: 'dhn', routeProgress: 0.3, coordinates: [85.78, 24.69] },
      '12303': { currentStation: 'ald', nextStation: 'bsb', routeProgress: 0.4, coordinates: [82.40, 25.38] },
      '12305': { currentStation: 'cnb', nextStation: 'ald', routeProgress: 0.5, coordinates: [81.09, 25.95] },
      '13005': { currentStation: 'dhn', nextStation: 'hwh', routeProgress: 0.2, coordinates: [87.38, 23.18] },
      '12273': { currentStation: 'ndls', nextStation: 'cnb', routeProgress: 0.6, coordinates: [78.78, 27.54] }
    };

    const trains = routes.map(route => {
      const active = activeStates[route.trainId] || {
        currentStation: route.stops[0]?.stationCode.toLowerCase() || 'ndls',
        nextStation: route.stops[1]?.stationCode.toLowerCase() || 'cnb',
        routeProgress: 0.0,
        coordinates: [77.2217, 28.6419]
      };

      return {
        id: route.trainId,
        name: route.name,
        type: route.type,
        capacity: route.capacity,
        passengerCount: route.passengerCount,
        speed: route.speed,
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
    const routes = readRoutes();
    const delays = readDelays();
    const trainId = req.params.id;

    const route = routes.find(r => r.trainId === trainId);
    if (!route) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Helper function to add delay minutes to time string (HH:MM format)
    const addMinutesToTime = (timeStr, mins) => {
      if (!timeStr || !mins) return timeStr;
      const [h, m] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m + mins, 0, 0);
      return date.toTimeString().substring(0, 5);
    };

    const stops = route.stops.map(stop => {
      const delayRecord = delays.find(d => d.trainId === trainId && d.stationCode === stop.stationCode);
      const delay = delayRecord ? delayRecord.delayMinutes : 0;

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
      trainId: route.trainId,
      stops
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

    const stations = readStations();
    const routes = readRoutes();
    const delays = readDelays();

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
      '12273': { currentStation: 'ndls', nextStation: 'cnb' }
    };

    const affectedTrains = routes.filter(route => {
      const active = activeStates[route.trainId] || { currentStation: '', nextStation: '' };
      return downstreamStationIds.includes(active.currentStation) || downstreamStationIds.includes(active.nextStation);
    });

    // Look up historical matching delay averages if available
    const matchingHistoricalDelay = delays.find(
      d => d.stationCode.toLowerCase() === stationId.toLowerCase() && d.cause === scenario
    );

    let delayMultiplier = 20;
    let conflictWeight = 1.5;

    if (matchingHistoricalDelay) {
      delayMultiplier = matchingHistoricalDelay.delayMinutes;
      conflictWeight = matchingHistoricalDelay.severity === 'severe' ? 3.5 :
                       matchingHistoricalDelay.severity === 'moderate' ? 2.0 : 1.2;
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
    const passengersAffected = affectedTrains.reduce((sum, t) => sum + t.passengerCount, 0);

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
