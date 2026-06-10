import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR } from '../../data/corridor';

declare global {
  const maplibregl: any;
}

// Train color mapping - each train has a unique color for its route line and marker
const TRAIN_COLORS: Record<string, string> = {
  '12301': '#3b82f6', // blue
  '12303': '#f59e0b', // amber
  '12305': '#22c55e', // green
  '13005': '#a855f7', // purple
  '12273': '#ef4444', // red
};

// Short train names for map labels
const TRAIN_SHORT_NAMES: Record<string, string> = {
  '12301': 'Rajdhani',
  '12303': 'Poorva',
  '12305': 'Rajdhani',
  '13005': 'Mail',
  '12273': 'Duronto',
};

// Station code to full name mapping for labels
const STATION_FULL_NAMES: Record<string, string> = {
  'NDLS': 'New Delhi',
  'CNB': 'Kanpur',
  'ALD': 'Prayagraj',
  'BSB': 'Varanasi',
  'PNBE': 'Patna',
  'DHN': 'Dhanbad',
  'HWH': 'Howrah',
};

// Helper function to generate a circle polygon in GeoJSON format
function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64) {
  const [lng, lat] = center;
  const coords: number[][] = [];
  const km = radiusInKm;
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.57;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] }
  };
}

// Generate stations GeoJSON with risk colors
const getStationsGeoJSON = (stationRisks: any) => {
  return {
    type: 'FeatureCollection',
    features: CORRIDOR.stations.map(station => {
      const risks = stationRisks[station.id] || { crowdRisk: 'low', delayRisk: 'low', platformConflicts: 0 };
      let color = '#22c55e';
      if (risks.crowdRisk === 'moderate') color = '#f59e0b';
      else if (risks.crowdRisk === 'high') color = '#f97316';
      else if (risks.crowdRisk === 'critical') color = '#ef4444';
      return {
        type: 'Feature',
        properties: {
          id: station.id,
          name: station.name,
          code: station.code,
          platforms: station.platforms,
          crowdRisk: risks.crowdRisk,
          delayRisk: risks.delayRisk,
          conflicts: risks.platformConflicts,
          color: color
        },
        geometry: { type: 'Point', coordinates: station.coordinates }
      };
    })
  };
};

// Tile style URLs in priority order (most reliable first)
const TILE_STYLES = [
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  'https://demotiles.maplibre.org/style.json',
];

export const CorridorMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [loadingText, setLoadingText] = useState('Connecting to tile server...');
  const [maplibReady, setMaplibReady] = useState(false);
  const styleIndexRef = useRef(0);
  // Use a ref to avoid stale closure in setTimeout callbacks
  const mapLoadedRef = useRef(false);

  const trains = useDemoStore(state => state.trains);
  const stationRisks = useDemoStore(state => state.stationRisks);
  const weatherAlert = useDemoStore(state => state.weatherAlert);
  const activePanel = useDemoStore(state => state.activePanel);
  const demoTime = useDemoStore(state => state.demoTime);

  const markersRef = useRef<Record<string, { marker: any; element: HTMLDivElement; inner?: HTMLDivElement; label?: HTMLDivElement }>>({});
  const prevDelaysRef = useRef<Record<string, number>>({});

  // Poll for maplibregl script load
  useEffect(() => {
    if (typeof maplibregl !== 'undefined') { setMaplibReady(true); return; }
    const interval = setInterval(() => {
      if (typeof maplibregl !== 'undefined') { setMaplibReady(true); clearInterval(interval); }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Initialize map with error + timeout handling
  useEffect(() => {
    if (!maplibReady || !mapContainer.current) return;

    const initMap = (styleUrl: string) => {
      // Clean up any existing map
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      setLoadingText('Loading map tiles...');
      setMapError(false);

      const map = new maplibregl.Map({
        container: mapContainer.current!,
        style: styleUrl,
        center: [84.0, 25.5],
        zoom: 5.5,
        attributionControl: false,
      });

      mapRef.current = map;
      if (window.innerWidth <= 768) { map.scrollZoom.disable(); }

      // Timeout — if tiles don't load in 10s, try fallback
      const timeoutId = setTimeout(() => {
        if (!mapLoadedRef.current) {
          const nextIdx = styleIndexRef.current + 1;
          if (nextIdx < TILE_STYLES.length) {
            styleIndexRef.current = nextIdx;
            setLoadingText('Retrying with fallback tiles...');
            initMap(TILE_STYLES[nextIdx]);
          } else {
            setMapError(true);
          }
        }
      }, 10000);

      map.on('error', (e: any) => {
        // Ignore individual tile 404s (non-fatal), but catch style/source load failures
        if (e?.error?.status === 404 && e?.sourceId) return;
        clearTimeout(timeoutId);
        const nextIdx = styleIndexRef.current + 1;
        if (nextIdx < TILE_STYLES.length) {
          styleIndexRef.current = nextIdx;
          setLoadingText('Switching tile source...');
          setTimeout(() => initMap(TILE_STYLES[nextIdx]), 500);
        } else {
          setMapError(true);
        }
      });

      map.on('load', () => {
        clearTimeout(timeoutId);
        mapLoadedRef.current = true;
        setMapLoaded(true);
        setMapError(false);
        const sortedStations = [...CORRIDOR.stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

      // ═══════════════════════════════════════════════════════════
      // LAYER 1: Main Corridor Route Line (thick, bright blue)
      // ═══════════════════════════════════════════════════════════
      map.addSource('corridor-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: sortedStations.map(s => s.coordinates)
          }
        }
      });

      // Glow layer (wider, more transparent)
      map.addLayer({
        id: 'route-line-glow',
        type: 'line',
        source: 'corridor-route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
          'line-opacity': 0.12,
        }
      });

      // Main corridor line
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'corridor-route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [4, 3]
        }
      });

      // ═══════════════════════════════════════════════════════════
      // LAYER 1b: Individual Train Route Paths (colored per train)
      // ═══════════════════════════════════════════════════════════
      const initialTrains = useDemoStore.getState().trains;
      const trainRouteFeatures = initialTrains.map(train => {
        const fromStation = sortedStations.find(s => s.id === train.currentStation);
        const toStation = sortedStations.find(s => s.id === train.nextStation);
        if (!fromStation || !toStation) return null;
        return {
          type: 'Feature' as const,
          properties: { trainId: train.id, color: TRAIN_COLORS[train.id] || '#3b82f6' },
          geometry: {
            type: 'LineString' as const,
            coordinates: [fromStation.coordinates, toStation.coordinates]
          }
        };
      }).filter(Boolean);

      map.addSource('train-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: trainRouteFeatures as any[] }
      });

      // Glow for train routes
      map.addLayer({
        id: 'train-route-glow',
        type: 'line',
        source: 'train-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 10,
          'line-opacity': 0.08,
        }
      });

      map.addLayer({
        id: 'train-route-lines',
        type: 'line',
        source: 'train-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.6,
          'line-dasharray': [8, 5]
        }
      });

      // ═══════════════════════════════════════════════════════════
      // LAYER 2: Station Circle Markers (outer ring)
      // ═══════════════════════════════════════════════════════════
      map.addSource('stations', {
        type: 'geojson',
        data: getStationsGeoJSON(useDemoStore.getState().stationRisks)
      });

      // Outer glow ring
      map.addLayer({
        id: 'station-glow',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.15,
          'circle-blur': 0.8
        }
      });

      // Main station circle
      map.addLayer({
        id: 'station-circles',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-stroke-opacity': 0.9
        }
      });

      // Station code labels (bold, with halo)
      map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        layout: {
          'text-field': ['get', 'code'],
          'text-size': 12,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0a0a0a',
          'text-halo-width': 2,
          'text-halo-blur': 1
        }
      });

      // Station full name labels (smaller, below code)
      map.addLayer({
        id: 'station-fullnames',
        type: 'symbol',
        source: 'stations',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-offset': [0, 3.0],
          'text-anchor': 'top',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
        },
        paint: {
          'text-color': '#666666',
          'text-halo-color': '#0a0a0a',
          'text-halo-width': 1.5,
          'text-halo-blur': 0.5
        }
      });

      // ═══════════════════════════════════════════════════════════
      // Station click popup
      // ═══════════════════════════════════════════════════════════
      map.on('click', 'station-circles', (e: any) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { name, code, crowdRisk, conflicts, platforms } = e.features[0].properties;
        const riskColor = crowdRisk === 'critical' ? '#ef4444' : crowdRisk === 'high' ? '#f97316' : crowdRisk === 'moderate' ? '#f59e0b' : '#22c55e';

        const html = `
          <div style="background:#0a0a0a; color:#fff; font-family:system-ui,sans-serif; font-size:12px; border:1px solid #222; padding:14px; border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,0.7); min-width:180px;">
            <div style="font-weight:700; font-size:14px; margin-bottom:2px; color:#3b82f6;">${name}</div>
            <div style="font-size:10px; color:#555; margin-bottom:10px; font-family:monospace;">${code} · ${platforms} platforms</div>
            <div style="display:flex; flex-direction:column; gap:5px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#888;">Crowd Risk</span>
                <span style="color:${riskColor}; font-weight:700; font-size:11px; background:${riskColor}15; padding:2px 8px; border-radius:4px;">${crowdRisk.toUpperCase()}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#888;">Platform Conflicts</span>
                <span style="font-weight:700; color:${conflicts > 0 ? '#ef4444' : '#22c55e'}; font-size:11px;">${conflicts}</span>
              </div>
            </div>
          </div>
        `;
        new maplibregl.Popup({ closeButton: false, offset: 12, maxWidth: '240px' })
          .setLngLat(coordinates).setHTML(html).addTo(map);
      });

      map.on('mouseenter', 'station-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'station-circles', () => { map.getCanvas().style.cursor = ''; });
    }); // end map.on('load')
    }; // end initMap

    // Start with first style
    mapLoadedRef.current = false;
    initMap(TILE_STYLES[0]);

    return () => {
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      markersRef.current = {};
      mapLoadedRef.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [maplibReady]);


  // Sync station risks
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource('stations');
    if (source) { source.setData(getStationsGeoJSON(stationRisks)); }
  }, [stationRisks, mapLoaded]);

  // Fly-to animations at demo milestones
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (demoTime === 4) {
      const pnbe = CORRIDOR.stations.find(s => s.id === 'pnbe');
      if (pnbe) { map.flyTo({ center: pnbe.coordinates, zoom: 8.0, duration: 1500 }); }
    } else if (demoTime === 12) {
      map.flyTo({ center: [84.0, 25.5], zoom: 5.5, duration: 1000 });
    } else if (demoTime === 42) {
      const pnbe = CORRIDOR.stations.find(s => s.id === 'pnbe');
      if (pnbe) { map.flyTo({ center: pnbe.coordinates, zoom: 7.0, duration: 1200 }); }
    }
  }, [demoTime, mapLoaded]);

  // Resize/zoom based on panel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    setTimeout(() => {
      map.resize();
      const currentDemoTime = useDemoStore.getState().demoTime;
      const currentDemoRunning = useDemoStore.getState().demoRunning;
      if (currentDemoRunning && currentDemoTime === 12) return;
      if (activePanel !== 'map') {
        map.easeTo({ zoom: 5.0, center: [84.0, 25.5], duration: 350 });
      } else {
        map.easeTo({ zoom: 5.5, center: [84.0, 25.5], duration: 350 });
      }
    }, 150);
  }, [activePanel, mapLoaded]);

  // ═══════════════════════════════════════════════════════════════
  // Train Marker Rendering (pill shape with name label)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const sortedStations = [...CORRIDOR.stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

    trains.forEach(train => {
      let markerEntry = markersRef.current[train.id];
      const trainColor = TRAIN_COLORS[train.id] || '#3b82f6';
      const trainName = TRAIN_SHORT_NAMES[train.id] || train.name;

      if (!markerEntry) {
        // Create container (holds pill + label)
        const el = document.createElement('div');
        el.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer;';

        // ── Pill marker ──
        const pill = document.createElement('div');
        pill.style.cssText = `
          display:flex; align-items:center; justify-content:center; gap:4px;
          height:26px; padding:0 8px 0 6px;
          border-radius:13px;
          background:#0f0f0f;
          border:2px solid ${trainColor};
          box-shadow: 0 0 12px ${trainColor}40, 0 2px 8px rgba(0,0,0,0.5);
          font-family: 'Geist Mono', monospace;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        `;

        // Color dot inside pill
        const dot = document.createElement('div');
        dot.style.cssText = `width:6px; height:6px; border-radius:50%; background:${trainColor}; flex-shrink:0;`;
        pill.appendChild(dot);

        // Train ID text
        const idText = document.createElement('span');
        idText.style.cssText = `color:#fff; font-size:9px; font-weight:700; letter-spacing:0.03em; line-height:1;`;
        idText.innerText = train.id;
        pill.appendChild(idText);

        el.appendChild(pill);

        // ── Name label below pill ──
        const label = document.createElement('div');
        label.style.cssText = `
          font-family: system-ui, sans-serif;
          font-size:9px; font-weight:600;
          color:${trainColor};
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          white-space:nowrap;
          line-height:1;
          opacity:0.9;
        `;
        label.innerText = trainName;
        el.appendChild(label);

        const popup = new maplibregl.Popup({ closeButton: false, offset: 24, maxWidth: '260px' });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(train.coordinates)
          .setPopup(popup)
          .addTo(map);

        markerEntry = { marker, element: el, inner: pill, label };
        markersRef.current[train.id] = markerEntry;
      } else {
        markerEntry.marker.setLngLat(train.coordinates);
      }

      // ── Update delay styling ──
      const pill = markerEntry.inner;
      if (pill) {
        if (train.predictedDelay > 30) {
          pill.style.borderColor = '#ef4444';
          pill.style.boxShadow = '0 0 16px rgba(239,68,68,0.5), 0 2px 8px rgba(0,0,0,0.5)';
          pill.classList.remove('pulse-amber');
          pill.classList.add('pulse-red');
        } else if (train.predictedDelay > 0) {
          pill.style.borderColor = '#f59e0b';
          pill.style.boxShadow = '0 0 12px rgba(245,158,11,0.4), 0 2px 8px rgba(0,0,0,0.5)';
          pill.classList.remove('pulse-red');
          pill.classList.add('pulse-amber');
        } else {
          pill.style.borderColor = trainColor;
          pill.style.boxShadow = `0 0 12px ${trainColor}40, 0 2px 8px rgba(0,0,0,0.5)`;
          pill.classList.remove('pulse-amber', 'pulse-red');
        }

        // Bounce on delay change
        const prevDelay = prevDelaysRef.current[train.id];
        if (prevDelay !== undefined && prevDelay !== train.predictedDelay) {
          pill.classList.add('bounce-marker');
          setTimeout(() => pill.classList.remove('bounce-marker'), 500);
        }
        prevDelaysRef.current[train.id] = train.predictedDelay;
      }

      // ── Update name label color on delay ──
      const label = markerEntry.label;
      if (label) {
        if (train.predictedDelay > 30) {
          label.style.color = '#ef4444';
        } else if (train.predictedDelay > 0) {
          label.style.color = '#f59e0b';
        } else {
          label.style.color = trainColor;
        }
      }

      // ── Popup content ──
      const statusText = train.predictedDelay > 0 ? `Delayed +${train.predictedDelay}m` : 'On Schedule';
      const delayColor = train.predictedDelay > 30 ? '#ef4444' : train.predictedDelay > 0 ? '#f59e0b' : '#22c55e';
      const occupancy = Math.round((train.passengerCount / train.capacity) * 100);

      const fromStation = sortedStations.find(s => s.id === train.currentStation);
      const toStation = sortedStations.find(s => s.id === train.nextStation);
      const fromName = fromStation ? STATION_FULL_NAMES[fromStation.code] || fromStation.code : train.currentStation.toUpperCase();
      const toName = toStation ? STATION_FULL_NAMES[toStation.code] || toStation.code : train.nextStation.toUpperCase();

      const popupContent = `
        <div style="background:#0a0a0a; color:#fff; font-family:system-ui,sans-serif; font-size:12px; border:1px solid #222; padding:14px; border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,0.7); min-width:200px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #1a1a1a;">
            <div style="width:10px; height:10px; border-radius:50%; background:${trainColor}; flex-shrink:0;"></div>
            <div>
              <div style="font-weight:700; font-size:13px; color:${trainColor};">${train.name}</div>
              <div style="font-size:10px; color:#555; font-family:monospace;">${train.id} · ${train.type}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#666;">Route</span>
              <span style="color:#aaa; font-size:11px;">${fromName} → ${toName}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#666;">Speed</span>
              <span style="color:#fff; font-weight:600;">${train.speed} km/h</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#666;">Status</span>
              <span style="color:${delayColor}; font-weight:700; font-size:11px; background:${delayColor}15; padding:2px 8px; border-radius:4px;">${statusText}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#666;">Occupancy</span>
              <span style="color:#fff;">
                <span style="font-weight:600;">${occupancy}%</span>
                <span style="color:#555; font-size:10px;"> (${train.passengerCount.toLocaleString()}/${train.capacity.toLocaleString()})</span>
              </span>
            </div>
          </div>
        </div>
      `;
      markerEntry.marker.getPopup().setHTML(popupContent);
    });
  }, [trains, mapLoaded]);

  // ═══════════════════════════════════════════════════════════════
  // Weather Overlay
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const sourceId = 'weather-circle';
    const fillLayerId = 'weather-fill';
    const borderLayerId = 'weather-border';

    const cleanupLayers = () => {
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    cleanupLayers();

    if (weatherAlert && weatherAlert.station === 'pnbe') {
      const pnbeStation = CORRIDOR.stations.find(s => s.id === 'pnbe');
      if (pnbeStation) {
        map.addSource(sourceId, { type: 'geojson', data: createGeoJSONCircle(pnbeStation.coordinates, 20) });
        map.addLayer({
          id: fillLayerId, type: 'fill', source: sourceId,
          paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.15 }
        });
        map.addLayer({
          id: borderLayerId, type: 'line', source: sourceId,
          paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-opacity': 0.8 }
        });

        let startTime = Date.now();
        const pulseInterval = setInterval(() => {
          if (!mapRef.current || !mapRef.current.getLayer(fillLayerId)) { clearInterval(pulseInterval); return; }
          const elapsed = Date.now() - startTime;
          const opacity = 0.15 + 0.06 * Math.cos((elapsed / 2000) * 2 * Math.PI);
          mapRef.current.setPaintProperty(fillLayerId, 'fill-opacity', opacity);
        }, 50);

        return () => { clearInterval(pulseInterval); cleanupLayers(); };
      }
    }
  }, [weatherAlert, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading skeleton */}
      {!mapLoaded && !mapError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
          style={{ background: 'var(--color-bg-page)' }}
        >
          {/* Animated grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(var(--color-border-default) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-default) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
          <div className="relative flex flex-col items-center gap-3">
            {/* Spinner */}
            <div
              className="w-10 h-10 rounded-full animate-spin"
              style={{ border: '2px solid var(--color-border-default)', borderTopColor: 'var(--color-accent-blue)' }}
            />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                {loadingText}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                Delhi–Howrah Corridor
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
          style={{ background: 'var(--color-bg-page)' }}
        >
          <div
            className="flex flex-col items-center gap-3 p-6 rounded-xl border"
            style={{
              background: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-default)',
              boxShadow: 'var(--shadow-elevated)',
              maxWidth: 300,
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              ⚠
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Map tiles unavailable</div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                Could not reach tile servers. Check your network connection.
              </div>
            </div>
            <button
              onClick={() => { styleIndexRef.current = 0; setMapError(false); setMapLoaded(false); setMaplibReady(false); setTimeout(() => setMaplibReady(true), 100); }}
              className="px-4 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-colors"
              style={{
                background: 'var(--color-accent-blue)',
                color: '#fff',
                boxShadow: 'var(--glow-blue)',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ═══ Map Header ═══ */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="bg-[#0a0a0a]/90 backdrop-blur-sm border border-[#222222] rounded-xl px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />
            <div>
              <div className="text-[11px] font-bold text-white tracking-wide">Delhi–Howrah Corridor</div>
              <div className="text-[9px] text-[#555555] font-mono">1,531 km · 7 stations · 5 trains</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Map Legend ═══ */}
      <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
        <div className="bg-[#0a0a0a]/92 backdrop-blur-sm border border-[#1a1a1a] rounded-xl p-3.5 shadow-xl max-w-[200px]">
          {/* Station risk section */}
          <div className="mb-3">
            <div className="text-[9px] font-bold text-[#555] uppercase tracking-[0.12em] mb-2">Station Risk</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                { color: '#22c55e', label: 'Low' },
                { color: '#f59e0b', label: 'Moderate' },
                { color: '#f97316', label: 'High' },
                { color: '#ef4444', label: 'Critical' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color, boxShadow: `0 0 6px ${r.color}40` }} />
                  <span className="text-[10px] text-[#999]">{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#1a1a1a] my-2.5" />

          {/* Train routes section */}
          <div>
            <div className="text-[9px] font-bold text-[#555] uppercase tracking-[0.12em] mb-2">Trains</div>
            <div className="flex flex-col gap-1.5">
              {[
                { id: '12301', name: 'Rajdhani', color: '#3b82f6', dir: '→' },
                { id: '12303', name: 'Poorva', color: '#f59e0b', dir: '→' },
                { id: '12305', name: 'Rajdhani', color: '#22c55e', dir: '→' },
                { id: '13005', name: 'Mail', color: '#a855f7', dir: '→' },
                { id: '12273', name: 'Duronto', color: '#ef4444', dir: '→' },
              ].map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="w-4 h-[2.5px] rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span className="text-[10px] text-[#999] flex-1 truncate">{t.name}</span>
                  <span className="text-[9px] text-[#444] font-mono">{t.id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Direction hint */}
          <div className="mt-2.5 pt-2 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1.5 text-[9px] text-[#444]">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="flex-shrink-0">
                <path d="M1 3H9M7 1L9 3L7 5" stroke="#555" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Direction of travel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
