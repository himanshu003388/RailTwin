import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR, TRAIN_ROUTES } from '../../data/corridor';
import { AlertTriangle } from 'lucide-react';

declare global {
  const maplibregl: any;
}

// Train color mapping - each train has a unique color for its route line and marker
const TRAIN_COLORS: Record<string, string> = {
  '12301': '#3b82f6', // blue - Howrah Rajdhani
  '12302': '#06b6d4', // cyan - New Delhi Rajdhani
  '12305': '#22c55e', // green - Howrah Rajdhani via Patna
  '12306': '#10b981', // emerald - New Delhi Rajdhani via Patna
  '12259': '#ef4444', // red - Sealdah Duronto
  '12381': '#a855f7', // purple - Poorva Express
  '12382': '#ec4899', // pink - Poorva Express
};

// Short train names for map labels
const TRAIN_SHORT_NAMES: Record<string, string> = {
  '12301': 'Howrah Raj',
  '12302': 'NDLS Raj',
  '12305': 'Rajdhani',
  '12306': 'Rajdhani',
  '12259': 'Duronto',
  '12381': 'Poorva',
  '12382': 'Poorva',
};

// Station code to full name mapping for labels
const STATION_FULL_NAMES: Record<string, string> = {
  'NDLS': 'New Delhi',
  'CNB': 'Kanpur',
  'ALD': 'Prayagraj',
  'PNBE': 'Patna',
  'HWH': 'Howrah',
};

// Generate stations GeoJSON with risk colors and weather parameters
const getStationsGeoJSON = (stationRisks: any, stationsList: any[], weatherData: any) => {
  const list = stationsList || CORRIDOR.stations;
  return {
    type: 'FeatureCollection',
    features: list.map(station => {
      const risks = stationRisks[station.id] || { crowdRisk: 'low', delayRisk: 'low', platformConflicts: 0 };
      const weather = weatherData ? weatherData[station.id] : null;
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
          color: color,
          rainfall: weather ? weather.rainfall : 0,
          visibility: weather ? weather.visibility : 10,
          temperature: weather ? weather.temperature : 25,
          humidity: weather ? weather.humidity : 80,
          windSpeed: weather ? weather.windSpeed : 0,
          description: weather ? weather.description : 'Clear sky',
          source: weather ? weather.source : 'fallback'
        },
        geometry: { type: 'Point', coordinates: station.coordinates }
      };
    })
  };
};

// Tile style URLs in priority order (most reliable first)
const DARK_STYLES = [
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  'https://demotiles.maplibre.org/style.json',
];

const LIGHT_STYLES = [
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'https://demotiles.maplibre.org/style.json',
];

export const CorridorMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [loadingText, setLoadingText] = useState('Connecting to tile server...');
  const [maplibReady, setMaplibReady] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const styleIndexRef = useRef(0);
  // Use a ref to avoid stale closure in setTimeout callbacks
  const mapLoadedRef = useRef(false);

  const trains = useDemoStore(state => state.trains);
  const stationRisks = useDemoStore(state => state.stationRisks);
  const weatherData = useDemoStore(state => state.weatherData);
  const activePanel = useDemoStore(state => state.activePanel);
  const demoTime = useDemoStore(state => state.demoTime);
  const theme = useDemoStore(state => state.theme);
  const stations = useDemoStore(state => state.stations) || [];


  const markersRef = useRef<Record<string, { marker: any; element: HTMLDivElement; inner?: HTMLDivElement; label?: HTMLDivElement }>>({});
  const prevDelaysRef = useRef<Record<string, number>>({});

  // Track window width for responsive legend
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

    // Reset all state for new theme
    styleIndexRef.current = 0;
    mapLoadedRef.current = false;
    setMapLoaded(false);
    setMapError(false);
    setLoadingText('Loading map tiles...');

    const stylesToUse = theme === 'light' ? LIGHT_STYLES : DARK_STYLES;

    const initMap = (styleUrl: string) => {
      // Clean up any existing map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (!mapContainer.current) return;

      setMapError(false);

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [84.0, 25.5],
        zoom: 5.5,
        attributionControl: false,
      });

      mapRef.current = map;
      if (window.innerWidth <= 768) { map.scrollZoom.disable(); }

      // Timeout — if tiles don't load in 15s, try fallback
      const timeoutId = setTimeout(() => {
        if (destroyed || mapLoadedRef.current) return;
        const nextIdx = styleIndexRef.current + 1;
        if (nextIdx < stylesToUse.length) {
          styleIndexRef.current = nextIdx;
          setLoadingText('Retrying with fallback tiles...');
          initMap(stylesToUse[nextIdx]);
        } else {
          setMapError(true);
        }
      }, 15000);

      map.on('error', (e: any) => {
        if (destroyed) return;
        // Ignore individual tile 404s (non-fatal), but catch style/source load failures
        if (e?.error?.status === 404 && e?.sourceId) return;
        clearTimeout(timeoutId);
        const nextIdx = styleIndexRef.current + 1;
        if (nextIdx < stylesToUse.length) {
          styleIndexRef.current = nextIdx;
          setLoadingText('Switching tile source...');
          setTimeout(() => {
            if (!destroyed) initMap(stylesToUse[nextIdx]);
          }, 500);
        } else {
          setMapError(true);
        }
      });

      map.on('load', () => {
        if (destroyed) return;
        clearTimeout(timeoutId);
        mapLoadedRef.current = true;
        setMapLoaded(true);
        setMapError(false);
        const sortedStations = [...stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

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
          'line-color': theme === 'light' ? '#1a6dd4' : '#3b82f6',
          'line-width': theme === 'light' ? 10 : 8,
          'line-opacity': theme === 'light' ? 0.20 : 0.12,
        }
      });

      // Main corridor line
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'corridor-route',
        paint: {
          'line-color': theme === 'light' ? '#0b2e6f' : '#3b82f6',
          'line-width': theme === 'light' ? 5 : 3,
          'line-opacity': theme === 'light' ? 1 : 0.8,
          'line-dasharray': [4, 3]
        }
      });

      // ═══════════════════════════════════════════════════════════
      // LAYER 1b: Individual Train Full-Route Paths (colored per train)
      // ═══════════════════════════════════════════════════════════
      const trainRouteFeatures = Object.entries(TRAIN_ROUTES).map(([trainId, stationIds]) => {
        const coords = stationIds
          .map(id => sortedStations.find(s => s.id === id))
          .filter(Boolean)
          .map(s => s!.coordinates);
        if (coords.length < 2) return null;
        return {
          type: 'Feature' as const,
          properties: { trainId, color: TRAIN_COLORS[trainId] || '#3b82f6' },
          geometry: { type: 'LineString' as const, coordinates: coords }
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
          'line-width': theme === 'light' ? 14 : 10,
          'line-opacity': theme === 'light' ? 0.18 : 0.08,
        }
      });

      map.addLayer({
        id: 'train-route-lines',
        type: 'line',
        source: 'train-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': theme === 'light' ? 5 : 4,
          'line-opacity': theme === 'light' ? 0.85 : 0.6,
          'line-dasharray': [8, 5]
        }
      });

      // ═══════════════════════════════════════════════════════════
      // LAYER 2: Station Circle Markers (outer ring)
      // ═══════════════════════════════════════════════════════════
      map.addSource('stations', {
        type: 'geojson',
        data: getStationsGeoJSON(
          useDemoStore.getState().stationRisks,
          useDemoStore.getState().stations,
          useDemoStore.getState().weatherData
        )
      });

      // Outer glow ring
      map.addLayer({
        id: 'station-glow',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': theme === 'light' ? 16 : 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': theme === 'light' ? 0.25 : 0.15,
          'circle-blur': 0.8
        }
      });

      // Main station circle
      map.addLayer({
        id: 'station-circles',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': theme === 'light' ? 9 : 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': theme === 'light' ? '#1f2d44' : '#ffffff',
          'circle-stroke-width': theme === 'light' ? 2.5 : 2.5,
          'circle-stroke-opacity': 1
        }
      });

      // Station code labels (bold, with halo)
      map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        layout: {
          'text-field': ['get', 'code'],
          'text-size': theme === 'light' ? 13 : 12,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
        },
        paint: {
          'text-color': theme === 'light' ? '#1c1a17' : '#ffffff',
          'text-halo-color': theme === 'light' ? '#f7f4ee' : '#0a0a0a',
          'text-halo-width': theme === 'light' ? 3 : 2,
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
          'text-size': theme === 'light' ? 10 : 9,
          'text-offset': [0, 3.0],
          'text-anchor': 'top',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
        },
        paint: {
          'text-color': theme === 'light' ? '#3a4b5d' : '#666666',
          'text-halo-color': theme === 'light' ? '#f8fafb' : '#0a0a0a',
          'text-halo-width': theme === 'light' ? 2.5 : 1.5,
          'text-halo-blur': 0.5
        }
      });

      // ═══════════════════════════════════════════════════════════
      // Station click popup
      // ═══════════════════════════════════════════════════════════
      map.on('click', 'station-circles', (e: any) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const {
          name, code, crowdRisk, conflicts, platforms,
          rainfall, visibility, temperature, humidity, windSpeed, description, source
        } = e.features[0].properties;
        const riskColor = crowdRisk === 'critical' ? '#ef4444' : crowdRisk === 'high' ? '#f97316' : crowdRisk === 'moderate' ? '#f59e0b' : '#22c55e';

        const html = `
          <div style="background:${theme === 'light' ? '#ffffff' : '#0a0a0a'}; color:${theme === 'light' ? '#0f172a' : '#ffffff'}; font-family:system-ui,sans-serif; font-size:12px; border:1px solid ${theme === 'light' ? '#bcc8db' : '#222'}; padding:14px; border-radius:12px; box-shadow:${theme === 'light' ? '0 8px 28px rgba(79,103,145,0.15), 0 2px 8px rgba(0,0,0,0.06)' : '0 12px 32px rgba(0,0,0,0.7)'}; min-width:190px;">
            <div style="font-weight:700; font-size:14px; margin-bottom:2px; color:${theme === 'light' ? '#0052cc' : '#3b82f6'};">${name}</div>
            <div style="font-size:10px; color:${theme === 'light' ? '#5a6b7d' : '#888'}; margin-bottom:10px; font-family:monospace;">${code} · ${platforms} platforms</div>
            <div style="display:flex; flex-direction:column; gap:5px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2px;">
                <span style="color:${theme === 'light' ? '#5a6b7d' : '#888'};">Crowd Risk</span>
                <span style="color:${riskColor}; font-weight:700; font-size:11px; background:${riskColor}18; padding:2px 8px; border-radius:4px;">${crowdRisk.toUpperCase()}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                <span style="color:${theme === 'light' ? '#5a6b7d' : '#888'};">Platform Conflicts</span>
                <span style="font-weight:700; color:${conflicts > 0 ? '#dc2626' : '#16a34a'}; font-size:11px;">${conflicts}</span>
              </div>
              <div style="height:1px; background:${theme === 'light' ? '#d4dce6' : '#222'}; margin:6px 0;"></div>
              <div style="font-weight:600; font-size:10px; color:${theme === 'light' ? '#5a6b7d' : '#888'}; text-transform:uppercase; tracking-wide; margin-bottom:2px;">Live Weather (${source})</div>
              <div style="display:flex; flex-direction:column; gap:3px;">
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Condition</span>
                  <span style="font-weight:500;">${description}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Rainfall</span>
                  <span style="font-weight:500; color:${rainfall > 0 ? '#0284c7' : 'inherit'};">${rainfall} mm/h</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Visibility</span>
                  <span style="font-weight:500; color:${visibility < 10 ? '#d97706' : 'inherit'};">${visibility} km</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Temp / Humidity</span>
                  <span style="font-weight:500;">${temperature}°C / ${humidity}%</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Wind Speed</span>
                  <span style="font-weight:500; color:${windSpeed > 40 ? '#dc2626' : 'inherit'};">${windSpeed} km/h</span>
                </div>
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
    let destroyed = false;
    initMap(stylesToUse[0]);

    return () => {
      destroyed = true;
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      markersRef.current = {};
      mapLoadedRef.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [maplibReady, theme]);


  // Sync station risks and weather data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource('stations');
    if (source) { source.setData(getStationsGeoJSON(stationRisks, stations, weatherData)); }
  }, [stationRisks, mapLoaded, stations, weatherData]);

  // Fly-to animations at demo milestones
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (demoTime === 4) {
      const pnbe = stations.find(s => s.id === 'pnbe');
      if (pnbe) { map.flyTo({ center: pnbe.coordinates, zoom: 8.0, duration: 1500 }); }
    } else if (demoTime === 12) {
      map.flyTo({ center: [84.0, 25.5], zoom: 5.5, duration: 1000 });
    } else if (demoTime === 42) {
      const pnbe = stations.find(s => s.id === 'pnbe');
      if (pnbe) { map.flyTo({ center: pnbe.coordinates, zoom: 7.0, duration: 1200 }); }
    }
  }, [demoTime, mapLoaded, stations]);

  // Resize/zoom based on panel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      const currentDemoTime = useDemoStore.getState().demoTime;
      const currentDemoRunning = useDemoStore.getState().demoRunning;
      if (currentDemoRunning && currentDemoTime === 12) return;
      if (activePanel !== 'map') {
        mapRef.current.easeTo({ zoom: 5.0, center: [84.0, 25.5], duration: 350 });
      } else {
        mapRef.current.easeTo({ zoom: 5.5, center: [84.0, 25.5], duration: 350 });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activePanel, mapLoaded]);

  // ═══════════════════════════════════════════════════════════════
  // Train Marker Rendering (pill shape with name label)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const sortedStations = [...stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);

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
          background:${theme === 'light' ? '#ffffff' : '#0f0f0f'};
          border:2.5px solid ${trainColor};
          box-shadow: 0 0 14px ${trainColor}${theme === 'light' ? '55' : '40'}, 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'};
          font-family: 'Geist Mono', monospace;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        `;

        // Color dot inside pill
        const dot = document.createElement('div');
        dot.style.cssText = `width:6px; height:6px; border-radius:50%; background:${trainColor}; flex-shrink:0;`;
        pill.appendChild(dot);

        // Train ID text
        const idText = document.createElement('span');
        idText.style.cssText = `color:${theme === 'light' ? '#0f172a' : '#fff'}; font-size:9px; font-weight:700; letter-spacing:0.03em; line-height:1;`;
        idText.innerText = train.id;
        pill.appendChild(idText);

        el.appendChild(pill);

        // ── Name label below pill ──
        const label = document.createElement('div');
        label.style.cssText = `
          font-family: system-ui, sans-serif;
          font-size:9px; font-weight:700;
          color:${trainColor};
          text-shadow: ${theme === 'light' ? '0 1px 3px rgba(247,244,238,0.95), 0 0 8px rgba(247,244,238,0.8)' : '0 1px 4px rgba(0,0,0,0.8)'};
          white-space:nowrap;
          line-height:1;
          opacity:0.95;
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
          pill.style.borderColor = '#dc2626';
          pill.style.boxShadow = `0 0 18px rgba(220,38,38,${theme === 'light' ? '0.5' : '0.5'}), 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'}`;
          pill.classList.remove('pulse-amber');
          pill.classList.add('pulse-red');
        } else if (train.predictedDelay > 0) {
          pill.style.borderColor = '#d97706';
          pill.style.boxShadow = `0 0 14px rgba(217,119,6,${theme === 'light' ? '0.45' : '0.4'}), 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'}`;
          pill.classList.remove('pulse-red');
          pill.classList.add('pulse-amber');
        } else {
          pill.style.borderColor = trainColor;
          pill.style.boxShadow = `0 0 14px ${trainColor}${theme === 'light' ? '55' : '40'}, 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'}`;
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
      const fromName = fromStation ? STATION_FULL_NAMES[fromStation.code] || fromStation.name : train.currentStation.toUpperCase();
      const toName = toStation ? STATION_FULL_NAMES[toStation.code] || toStation.name : train.nextStation.toUpperCase();

      const popupContent = `
        <div style="background:${theme === 'light' ? '#ffffff' : '#0a0a0a'}; color:${theme === 'light' ? '#1c1a17' : '#ffffff'}; font-family:system-ui,sans-serif; font-size:12px; border:1px solid ${theme === 'light' ? '#c2b9a8' : '#222'}; padding:14px; border-radius:12px; box-shadow:${theme === 'light' ? '0 8px 28px rgba(80,60,40,0.18), 0 2px 8px rgba(0,0,0,0.08)' : '0 12px 32px rgba(0,0,0,0.7)'}; min-width:200px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid ${theme === 'light' ? '#d6cec0' : '#1a1a1a'};">
            <div style="width:10px; height:10px; border-radius:50%; background:${trainColor}; flex-shrink:0; box-shadow: 0 0 6px ${trainColor}55;"></div>
            <div>
              <div style="font-weight:700; font-size:13px; color:${trainColor};">${train.name}</div>
              <div style="font-size:10px; color:${theme === 'light' ? '#6b6559' : '#555'}; font-family:monospace;">${train.id} · ${train.type}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Route</span>
              <span style="color:${theme === 'light' ? '#4a453e' : '#aaa'}; font-size:11px;">${fromName} → ${toName}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Speed</span>
              <span style="color:${theme === 'light' ? '#1c1a17' : '#fff'}; font-weight:600;">${train.speed} km/h</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Status</span>
              <span style="color:${delayColor}; font-weight:700; font-size:11px; background:${delayColor}18; padding:2px 8px; border-radius:4px;">${statusText}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Occupancy</span>
              <span style="color:${theme === 'light' ? '#1c1a17' : '#fff'};">
                <span style="font-weight:600;">${occupancy}%</span>
                <span style="color:${theme === 'light' ? '#6b6559' : '#555'}; font-size:10px;"> (${train.passengerCount.toLocaleString()}/${train.capacity.toLocaleString()})</span>
              </span>
            </div>
          </div>
        </div>
      `;
      markerEntry.marker.getPopup().setHTML(popupContent);
    });

    // Remove markers for trains that no longer exist
    const trainIds = new Set(trains.map(t => t.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!trainIds.has(id)) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
        delete prevDelaysRef.current[id];
      }
    });
  }, [trains, mapLoaded]);

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
        <div className="bg-bg-elevated/95 backdrop-blur-md border border-border-default rounded-xl px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
            <div>
              <div className="text-[11px] font-bold text-text-primary tracking-wide">Delhi–Howrah Corridor</div>
              <div className="text-[9px] text-text-secondary font-mono">1,531 km · 8 stations · 8 trains</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Map Legend ═══ */}
      {/* On desktop (>640px): always shown. On mobile: toggle between button and expanded legend */}
      {/* Expanded legend */}
      {(showMapLegend || windowWidth >= 640) && (
        <div className="absolute bottom-3 right-3 z-10 max-sm:left-2 max-sm:right-auto">
          <div className="bg-bg-elevated/95 backdrop-blur-md border border-border-default rounded-xl p-3.5 shadow-xl max-w-[200px] max-sm:max-w-[180px] pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.12em]">Legend</span>
              <button
                onClick={() => setShowMapLegend(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer sm:hidden"
                aria-label="Close legend"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="mb-3">
              <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.12em] mb-2">Station Risk</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {[
                  { color: '#16a34a', label: 'Low' },
                  { color: '#d97706', label: 'Moderate' },
                  { color: '#ea580c', label: 'High' },
                  { color: '#dc2626', label: 'Critical' },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color, boxShadow: `0 0 8px ${r.color}55` }} />
                    <span className="text-[10px] font-medium text-text-secondary">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-px bg-border-default my-2.5" />
            <div className="mb-3">
              <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.12em] mb-2">Weather</div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] bg-blue-500/10 border border-blue-500/30 text-blue-500">🌧</span>
                  <span className="text-[10px] font-medium text-text-secondary">Rainfall</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] bg-slate-500/10 border border-slate-500/30 text-slate-400">🌫</span>
                  <span className="text-[10px] font-medium text-text-secondary">Low Vis</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-border-default my-2.5" />
            <div>
              <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.12em] mb-2">Trains</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { id: '12301', name: 'Howrah Raj', color: '#3b82f6' },
                  { id: '12302', name: 'NDLS Raj', color: '#06b6d4' },
                  { id: '12305', name: 'Patna Raj', color: '#22c55e' },
                  { id: '12306', name: 'NDLS Raj', color: '#10b981' },
                  { id: '12259', name: 'Duronto', color: '#ef4444' },
                  { id: '12381', name: 'Poorva', color: '#a855f7' },
                  { id: '12382', name: 'Poorva', color: '#ec4899' },
                ].map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-4 h-[3px] rounded-full flex-shrink-0" style={{ background: t.color, boxShadow: `0 0 6px ${t.color}44` }} />
                    <span className="text-[10px] font-medium text-text-secondary flex-1 truncate">{t.name}</span>
                    <span className="text-[9px] text-text-muted font-mono">{t.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-border-subtle">
              <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="flex-shrink-0">
                  <path d="M1 3H9M7 1L9 3L7 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Direction of travel</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed legend button — mobile only, hidden when legend is open */}
      {!showMapLegend && windowWidth < 640 && (
        <button
          onClick={() => setShowMapLegend(true)}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-2 rounded-xl shadow-lg border border-border-default transition-all duration-150 active:scale-95 cursor-pointer pointer-events-auto"
          style={{
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
          }}
          aria-label="Open legend"
        >
          <AlertTriangle className="w-4 h-4 text-accent-amber" />
          <span className="text-[10px] font-semibold font-sans">Station Risk</span>
        </button>
      )}

      {/* ═══ Weather Info HUD ═══ */}
      <div className="absolute bottom-3 left-3 z-10 max-sm:left-2 max-sm:right-2">
        <div className="bg-bg-elevated/95 backdrop-blur-md border border-border-default rounded-xl p-3 shadow-xl w-[280px] max-sm:w-full flex flex-col gap-2.5 pointer-events-auto">
          <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2">
            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider font-sans">Live Weather</span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-accent-blue-soft text-accent-blue border border-accent-blue/20">
              {(() => {
                const sources = stations.map(s => weatherData?.[s.id]?.source).filter(Boolean);
                if (sources.includes('openweather')) return 'OWM';
                if (sources.includes('open-meteo')) return 'OPEN-METEO';
                return 'LIVE';
              })()}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[140px] max-sm:max-h-[100px] overflow-y-auto pr-0.5 scrollbar-thin">
            {stations.map(s => {
              const w = weatherData ? weatherData[s.id] : null;
              const hasRain = w && w.rainfall > 0;
              const hasFog = w && w.visibility < 5;
              let weatherEmoji = '☀️';
              let weatherColor = 'text-text-muted';
              if (hasRain) { weatherEmoji = '🌧️'; weatherColor = 'text-accent-blue'; }
              else if (hasFog) { weatherEmoji = '🌫️'; weatherColor = 'text-text-secondary'; }
              else if (w && w.description.toLowerCase().includes('cloud')) { weatherEmoji = '☁️'; weatherColor = 'text-text-tertiary'; }
              return (
                  <div key={s.id} onClick={() => { if (mapRef.current) mapRef.current.flyTo({ center: s.coordinates, zoom: 7.5, duration: 1000 }); }}
                  className="group flex items-center justify-between px-2 py-1.5 rounded bg-bg-sunken hover:bg-bg-hover border border-border-subtle hover:border-border-default transition-all duration-150 cursor-pointer text-[10px] font-mono"
                  title="Click to focus station on map">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-text-primary group-hover:text-accent-blue transition-colors">{s.code}</span>
                      <span className="text-text-tertiary truncate max-w-[65px] max-sm:max-w-[40px]">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right max-sm:gap-1">
                      <span className={weatherColor} title={w ? w.description : 'Unknown'}>{weatherEmoji}</span>
                      <span className="text-text-secondary font-medium max-sm:hidden" style={{ fontVariantNumeric: 'tabular-nums' }}>{w ? `${w.temperature}°` : '--'}</span>
                      <span className="text-[9px] text-text-muted select-none max-sm:hidden">|</span>
                      <span className="text-text-secondary w-14 max-sm:w-auto max-sm:text-[8px]" style={{ fontVariantNumeric: 'tabular-nums' }}>{hasRain ? `${w.rainfall}mm` : w ? `${w.visibility}km` : '--'}</span>
                    </div>
                  </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};
