import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { useDriftStore } from '../../stores/driftStore';
import { TRAIN_ROUTES, STATIONS, ALL_STATIONS, getTrainRoute } from '../../data/corridor';
import { TRACK_GEOMETRIES } from '../../data/trackGeometries';
import { makeReconItem } from '../../lib/reconciler';
import { Layers, Eye, EyeOff } from 'lucide-react';

declare global {
  const maplibregl: any;
}

if (typeof window !== 'undefined') {
  (window as any).railtwinAcceptLive = (trainId: string) => {
    const state = useDriftStore.getState();
    let item = state.reconItems.find(i => i.status === 'open' && i.entity === trainId);
    if (!item) {
      const train = useDemoStore.getState().trains.find(t => t.id === trainId);
      const tDrift = state.driftReport?.trains.find(t => t.trainId === trainId);
      item = makeReconItem({
        type: 'conflict',
        entity: trainId,
        entityLabel: `${trainId} · ${train?.name || 'Train'}`,
        field: 'schedule',
        sourceA: { name: 'Recorded Plan', value: `Delay ${tDrift?.baseline.delay ?? 0}m` },
        sourceB: { name: 'Live Reality', value: `Delay ${tDrift?.live.delay ?? 0}m` },
        severity: tDrift?.driftClass === 'critical' ? 'critical' : 'high',
        suggestedResolution: 'accept-live',
        suggestion: `Ghost marker accepted by operator. Re-anchoring baseline to live position and delay.`,
      });
      useDriftStore.setState(s => ({
        reconItems: [item!, ...s.reconItems],
      }));
    }
    state.resolveItem(item.id, 'accept-live');
    if ((window as any).activeDriftPopup) {
      try { (window as any).activeDriftPopup.remove(); } catch {}
    }
  };
}

const TRAIN_COLORS: Record<string, string> = {
  '12951': '#3b82f6', // Mumbai Rajdhani - blue
  '12007': '#22c55e', // Chennai Shatabdi - green
  '12423': '#a855f7', // Dibrugarh Rajdhani - purple
  '12801': '#f97316', // Purushottam Express - orange
  '12625': '#06b6d4', // Kerala Express - cyan
  '12137': '#ec4899', // Punjab Mail - pink
  '12301': '#eab308', // Howrah-NDLS Rajdhani - yellow
};

const TRAIN_SHORT_NAMES: Record<string, string> = {
  '12951': 'Mumbai Raj',
  '12007': 'Chennai Shat',
  '12423': 'DBRG Raj',
  '12801': 'Purushottam',
  '12625': 'Kerala Exp',
  '12137': 'Punjab Mail',
  '12301': 'HWH Raj',
};

const TRAIN_LEGEND = [
  { id: '12951', name: 'Mumbai Rajdhani', color: '#3b82f6' },
  { id: '12007', name: 'Chennai Shatabdi', color: '#22c55e' },
  { id: '12423', name: 'DBRG Rajdhani', color: '#a855f7' },
  { id: '12801', name: 'Purushottam Exp', color: '#f97316' },
  { id: '12625', name: 'Kerala Express', color: '#06b6d4' },
  { id: '12137', name: 'Punjab Mail', color: '#ec4899' },
  { id: '12301', name: 'HWH–NDLS Raj', color: '#eab308' },
];

const INDIA_CENTER: [number, number] = [79.5, 22.5];
const INDIA_ZOOM = 4.6;
const INDIA_ZOOM_PANEL = 4.3;

const getStationsGeoJSON = (stationRisks: any, stationsList: any[], weatherData: any) => {
  return {
    type: 'FeatureCollection',
    features: (stationsList.length ? stationsList : ALL_STATIONS).filter(s => s.id !== 'vz').map(station => {
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
          color,
          rainfall: weather ? weather.rainfall : 0,
          visibility: weather ? weather.visibility : 10,
          temperature: weather ? weather.temperature : 25,
          humidity: weather ? weather.humidity : 80,
          windSpeed: weather ? weather.windSpeed : 0,
          description: weather ? weather.description : 'Weather unavailable',
          source: weather ? weather.source : 'unavailable',
        },
        geometry: { type: 'Point', coordinates: station.coordinates },
      };
    }),
  };
};

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
  const [loadingText, setLoadingText] = useState('Connecting to live network...');
  const [maplibReady, setMaplibReady] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(false);
  const [showLiveWeather, setShowLiveWeather] = useState(false);
  const [desktopLegendOpen, setDesktopLegendOpen] = useState(false);
  const [showGhostOverlay, setShowGhostOverlay] = useState(true);
  const styleIndexRef = useRef(0);
  const mapLoadedRef = useRef(false);

  const trains = useDemoStore(state => state.trains);
  const stationRisks = useDemoStore(state => state.stationRisks);
  const weatherData = useDemoStore(state => state.weatherData);
  const activePanel = useDemoStore(state => state.activePanel);
  const theme = useDemoStore(state => state.theme);
  const stations = useDemoStore(state => state.stations) || [];
  const driftReport = useDriftStore(state => state.driftReport);

  const markersRef = useRef<Record<string, { marker: any; element: HTMLDivElement; inner?: HTMLDivElement; label?: HTMLDivElement; arrow?: HTMLDivElement }>>({});
  const prevDelaysRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (typeof maplibregl !== 'undefined') { setMaplibReady(true); return; }
    const interval = setInterval(() => {
      if (typeof maplibregl !== 'undefined') { setMaplibReady(true); clearInterval(interval); }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!maplibReady || !mapContainer.current) return;

    let destroyed = false;

    styleIndexRef.current = 0;
    mapLoadedRef.current = false;
    setMapLoaded(false);
    setMapError(false);
    setLoadingText('Loading map...');

    const stylesToUse = theme === 'light' ? LIGHT_STYLES : DARK_STYLES;

    const initMap = (styleUrl: string) => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (!mapContainer.current) return;
      setMapError(false);

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
        attributionControl: false,
      });

      mapRef.current = map;
      if (window.innerWidth <= 768) { map.scrollZoom.disable(); }

      const timeoutId = setTimeout(() => {
        if (destroyed || mapLoadedRef.current) return;
        const nextIdx = styleIndexRef.current + 1;
        if (nextIdx < stylesToUse.length) {
          styleIndexRef.current = nextIdx;
          setLoadingText('Trying another map source...');
          initMap(stylesToUse[nextIdx]);
        } else {
          setMapError(true);
        }
      }, 15000);

      map.on('error', (e: any) => {
        if (destroyed) return;
        if (e?.error?.status === 404 && e?.sourceId) return;
        clearTimeout(timeoutId);
        const nextIdx = styleIndexRef.current + 1;
        if (nextIdx < stylesToUse.length) {
          styleIndexRef.current = nextIdx;
          setLoadingText('Switching map source...');
          setTimeout(() => { if (!destroyed) initMap(stylesToUse[nextIdx]); }, 500);
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

        const trainRouteFeatures = Object.keys(TRAIN_ROUTES).map(trainId => {
          const trackGeom = TRACK_GEOMETRIES[trainId];
          const coords = trackGeom ? trackGeom.allCoords : Object.values(TRAIN_ROUTES[trainId].map(id => STATIONS[id]).filter(Boolean).map(s => s.coordinates));
          if (!coords || coords.length < 2) return null;
          return {
            type: 'Feature' as const,
            properties: { trainId, color: TRAIN_COLORS[trainId] || '#3b82f6' },
            geometry: { type: 'LineString' as const, coordinates: coords as [number, number][] },
          };
        }).filter(Boolean);

        map.addSource('train-routes', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: trainRouteFeatures as any[] },
        });

        map.addLayer({
          id: 'train-route-glow',
          type: 'line',
          source: 'train-routes',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': theme === 'light' ? 14 : 10,
            'line-opacity': theme === 'light' ? 0.18 : 0.08,
          },
        });

        map.addLayer({
          id: 'train-route-lines',
          type: 'line',
          source: 'train-routes',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': theme === 'light' ? 5 : 4,
            'line-opacity': theme === 'light' ? 0.85 : 0.6,
            'line-dasharray': [8, 5],
          },
        });

        // Station Circle Markers
        map.addSource('stations', {
          type: 'geojson',
          data: getStationsGeoJSON(
            useDemoStore.getState().stationRisks,
            useDemoStore.getState().stations,
            useDemoStore.getState().weatherData,
          ),
        });

        map.addLayer({
          id: 'station-glow',
          type: 'circle',
          source: 'stations',
          paint: {
            'circle-radius': theme === 'light' ? 14 : 12,
            'circle-color': ['get', 'color'],
            'circle-opacity': theme === 'light' ? 0.25 : 0.15,
            'circle-blur': 0.8,
          },
        });

        map.addLayer({
          id: 'station-circles',
          type: 'circle',
          source: 'stations',
          paint: {
            'circle-radius': theme === 'light' ? 8 : 7,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': theme === 'light' ? '#1f2d44' : '#ffffff',
            'circle-stroke-width': 2.5,
            'circle-stroke-opacity': 1,
          },
        });

        map.addLayer({
          id: 'station-labels',
          type: 'symbol',
          source: 'stations',
          layout: {
            'text-field': ['get', 'code'],
            'text-size': theme === 'light' ? 11 : 10,
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': theme === 'light' ? '#1c1a17' : '#ffffff',
            'text-halo-color': theme === 'light' ? '#f7f4ee' : '#0a0a0a',
            'text-halo-width': 2,
            'text-halo-blur': 1,
          },
        });

        map.addLayer({
          id: 'station-fullnames',
          type: 'symbol',
          source: 'stations',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': theme === 'light' ? 9 : 8,
            'text-offset': [0, 2.8],
            'text-anchor': 'top',
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          },
          paint: {
            'text-color': theme === 'light' ? '#3a4b5d' : '#666666',
            'text-halo-color': theme === 'light' ? '#f8fafb' : '#0a0a0a',
            'text-halo-width': 2,
            'text-halo-blur': 0.5,
          },
        });

        // ── Round 2 · Drift ghost markers ──
        // A ghost shows where the recorded context (baseline) implied the
        // train would be right now; a dashed link connects it to the live
        // position. One glance = how far reality has drifted from the plan.
        map.addSource('drift-links', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addSource('drift-ghosts', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'drift-link-lines',
          type: 'line',
          source: 'drift-links',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.75,
            'line-dasharray': [2, 3],
          },
        });
        map.addLayer({
          id: 'drift-ghost-circles',
          type: 'circle',
          source: 'drift-ghosts',
          paint: {
            'circle-radius': 7,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.25,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 0.9,
          },
        });
        map.addLayer({
          id: 'drift-ghost-labels',
          type: 'symbol',
          source: 'drift-ghosts',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 8,
            'text-offset': [0, -1.4],
            'text-anchor': 'bottom',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': theme === 'light' ? '#f7f4ee' : '#0a0a0a',
            'text-halo-width': 1.5,
          },
        });

        // ── Round 2 · Ghost marker inspector: Plan vs Live diff card ──
        const openDriftPopup = (e: any) => {
          const trainId = e.features?.[0]?.properties?.trainId;
          if (!trainId) return;
          const { driftReport, baseline } = useDriftStore.getState();
          const t = driftReport?.trains.find(tr => tr.trainId === trainId);
          if (!t) return;
          const comp = Object.fromEntries(t.components.map(c => [c.key, c]));
          const clsColor = t.driftClass === 'critical' ? '#ef4444' : t.driftClass === 'significant' ? '#f97316' : '#f59e0b';
          const planWeather = baseline?.weather[t.baseline.nextStation];
          const liveWeather = useDemoStore.getState().weatherData?.[t.live.nextStation];
          const muted = theme === 'light' ? '#6b6559' : '#888';
          const colCss = `flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;`;
          const rowCss = `display:flex; justify-content:space-between; gap:8px; font-size:10px;`;
          const html = `
            <div style="background:${theme === 'light' ? '#ffffff' : '#0a0a0a'}; color:${theme === 'light' ? '#0f172a' : '#fff'}; font-family:system-ui,sans-serif; font-size:12px; border:1px solid ${clsColor}55; padding:14px; border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,${theme === 'light' ? '0.15' : '0.7'}); min-width:250px; max-width:290px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid ${theme === 'light' ? '#e2e0da' : '#1a1a1a'};">
                <div>
                  <div style="font-weight:700; font-size:13px;">${trainId} · ${t.trainName}</div>
                  <div style="font-size:9px; color:${muted}; font-family:monospace; text-transform:uppercase;">Plan vs Live</div>
                </div>
                <span style="color:${clsColor}; font-weight:700; font-size:12px; background:${clsColor}18; border:1px solid ${clsColor}44; padding:2px 8px; border-radius:6px; font-family:monospace;">${Math.round(t.score)}/100</span>
              </div>
              <div style="display:flex; gap:10px; margin-bottom:8px;">
                <div style="${colCss}">
                  <div style="font-size:9px; font-weight:700; color:${muted}; text-transform:uppercase; letter-spacing:0.06em;">◌ Plan (recorded)</div>
                  <div style="${rowCss}"><span style="color:${muted};">Station</span><span style="font-weight:600;">${t.baseline.station.toUpperCase()}</span></div>
                  <div style="${rowCss}"><span style="color:${muted};">Delay</span><span style="font-weight:600;">${t.baseline.delay} min</span></div>
                  <div style="${rowCss}"><span style="color:${muted};">Progress</span><span style="font-weight:600;">${Math.round(t.baseline.progress * 100)}%</span></div>
                  <div style="${rowCss}"><span style="color:${muted};">Weather</span><span style="font-weight:600;">${planWeather ? planWeather.description : '—'}</span></div>
                </div>
                <div style="width:1px; background:${theme === 'light' ? '#e2e0da' : '#1a1a1a'};"></div>
                <div style="${colCss}">
                  <div style="font-size:9px; font-weight:700; color:${clsColor}; text-transform:uppercase; letter-spacing:0.06em;">● Live (observed)</div>
                  <div style="${rowCss}"><span style="color:${muted};">Station</span><span style="font-weight:600;">${t.live.station.toUpperCase()}</span></div>
                  <div style="${rowCss}"><span style="color:${muted};">Delay</span><span style="font-weight:600; color:${t.live.delay > t.baseline.delay ? '#ef4444' : 'inherit'};">${t.live.delay > 0 ? '+' : ''}${t.live.delay} min</span></div>
                  <div style="${rowCss}"><span style="color:${muted};">Progress</span><span style="font-weight:600;">${Math.round(t.live.progress * 100)}%</span></div>
                  <div style="${rowCss}"><span style="color:${muted};">Weather</span><span style="font-weight:600;">${liveWeather ? liveWeather.description : '—'}</span></div>
                </div>
              </div>
              <div style="background:${clsColor}10; border:1px solid ${clsColor}33; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
                <div style="font-size:9px; font-weight:700; color:${clsColor}; text-transform:uppercase; letter-spacing:0.06em;">Δ Drift breakdown</div>
                <div style="${rowCss}"><span style="color:${muted};">Δ Delay (schedule)</span><span style="font-weight:700; font-family:monospace;">${comp.schedule ? comp.schedule.raw : 0} min → ${comp.schedule ? comp.schedule.weighted : 0} pts</span></div>
                <div style="${rowCss}"><span style="color:${muted};">Δ Distance (position)</span><span style="font-weight:700; font-family:monospace;">${comp.position ? Math.round(comp.position.raw) : 0} km → ${comp.position ? comp.position.weighted : 0} pts</span></div>
                <div style="${rowCss}"><span style="color:${muted};">Prediction assumptions</span><span style="font-weight:700; font-family:monospace;">${comp.prediction ? comp.prediction.weighted : 0} pts</span></div>
                <div style="${rowCss}"><span style="color:${muted};">Weather vs forecast</span><span style="font-weight:700; font-family:monospace;">${comp.weather ? comp.weather.weighted : 0} pts</span></div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                <span style="font-size:8px; color:${muted}; font-family:monospace;">◌ ghost = plan coordinates</span>
                <button onclick="window.railtwinAcceptLive('${trainId}')" style="background:${clsColor}; color:#ffffff; border:none; border-radius:6px; padding:4px 10px; font-size:10px; font-weight:700; font-family:monospace; cursor:pointer; box-shadow:0 2px 8px ${clsColor}66; transition:all 0.15s; display:inline-flex; align-items:center; gap:4px;">
                  ✓ Accept live
                </button>
              </div>
            </div>`;
          const popup = new maplibregl.Popup({ closeButton: true, offset: 10, maxWidth: '300px' })
            .setLngLat(e.lngLat).setHTML(html).addTo(map);
          (window as any).activeDriftPopup = popup;
        };
        map.on('click', 'drift-ghost-circles', openDriftPopup);
        map.on('click', 'drift-link-lines', openDriftPopup);
        map.on('mouseenter', 'drift-ghost-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'drift-ghost-circles', () => { map.getCanvas().style.cursor = ''; });

        // Station click popup
        map.on('click', 'station-circles', (e: any) => {
          const coordinates = e.features[0].geometry.coordinates.slice();
          const { name, code, crowdRisk, conflicts, platforms, rainfall, visibility, temperature, humidity, windSpeed, description, source } = e.features[0].properties;
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
                  <span style="color:${theme === 'light' ? '#5a6b7d' : '#888'};">Conflicts</span>
                  <span style="font-weight:700; color:${conflicts > 0 ? '#dc2626' : '#16a34a'}; font-size:11px;">${conflicts}</span>
                </div>
                <div style="height:1px; background:${theme === 'light' ? '#d4dce6' : '#222'}; margin:6px 0;"></div>
                <div style="font-weight:600; font-size:10px; color:${theme === 'light' ? '#5a6b7d' : '#888'}; text-transform:uppercase; margin-bottom:2px;">Live Weather (${source})</div>
                <div style="display:flex; flex-direction:column; gap:3px;">
                  <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Condition</span><span style="font-weight:500;">${description}</span></div>
                  <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Rainfall</span><span style="font-weight:500; color:${rainfall > 0 ? '#0284c7' : 'inherit'};">${rainfall} mm/h</span></div>
                  <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Visibility</span><span style="font-weight:500; color:${visibility < 10 ? '#d97706' : 'inherit'};">${visibility} km</span></div>
                  <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Temp</span><span style="font-weight:500;">${temperature}°C / ${humidity}%</span></div>
                  <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#8a9aad' : '#666'};">Wind</span><span style="font-weight:500; color:${windSpeed > 40 ? '#dc2626' : 'inherit'};">${windSpeed} km/h</span></div>
                </div>
              </div>
            </div>
          `;
          new maplibregl.Popup({ closeButton: false, offset: 12, maxWidth: '240px' })
            .setLngLat(coordinates).setHTML(html).addTo(map);
        });

        map.on('mouseenter', 'station-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'station-circles', () => { map.getCanvas().style.cursor = ''; });
      });
    };

    initMap(stylesToUse[0]);

    return () => {
      destroyed = true;
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      markersRef.current = {};
      mapLoadedRef.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maplibReady, theme, stations.length]);

  // Sync station risks and weather data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource('stations');
    if (source) { source.setData(getStationsGeoJSON(stationRisks, stations, weatherData)); }
  }, [stationRisks, mapLoaded, stations, weatherData]);

  // Round 2 · Sync drift ghost markers with the latest drift report
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const ghostSource = map.getSource('drift-ghosts');
    const linkSource = map.getSource('drift-links');
    if (!ghostSource || !linkSource) return;

    const classColor: Record<string, string> = {
      minor: '#f59e0b', significant: '#f97316', critical: '#ef4444',
    };
    const drifting = (driftReport?.trains || []).filter(t => t.driftClass !== 'stable');

    ghostSource.setData({
      type: 'FeatureCollection',
      features: drifting.map(t => ({
        type: 'Feature' as const,
        properties: {
          trainId: t.trainId,
          color: classColor[t.driftClass] || '#f59e0b',
          label: `${t.trainId} PLAN`,
        },
        geometry: { type: 'Point' as const, coordinates: t.expected.coordinates },
      })),
    });
    linkSource.setData({
      type: 'FeatureCollection',
      features: drifting.map(t => ({
        type: 'Feature' as const,
        properties: { trainId: t.trainId, color: classColor[t.driftClass] || '#f59e0b' },
        geometry: { type: 'LineString' as const, coordinates: [t.expected.coordinates, t.live.coordinates] },
      })),
    });
  }, [driftReport, mapLoaded]);

  // Round 2 · Ghost overlay visibility toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const visibility = showGhostOverlay ? 'visible' : 'none';
    for (const layerId of ['drift-ghost-circles', 'drift-link-lines', 'drift-ghost-labels']) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }, [showGhostOverlay, mapLoaded, driftReport]);



  // Resize/zoom based on panel & viewport changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (mapContainer.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(mapContainer.current);
    }

    window.addEventListener('resize', handleResize);

    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      const isMobile = window.innerWidth <= 768;
      const targetZoom = activePanel !== 'map' ? (isMobile ? 3.8 : INDIA_ZOOM_PANEL) : (isMobile ? 3.9 : INDIA_ZOOM);
      mapRef.current.easeTo({ zoom: targetZoom, center: INDIA_CENTER, duration: 350 });
    }, 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [activePanel, mapLoaded]);

  function bearing(from: [number, number], to: [number, number]): number {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  // Train Marker Rendering
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    trains.forEach(train => {
      let markerEntry = markersRef.current[train.id];
      const trainColor = TRAIN_COLORS[train.id] || '#3b82f6';
      const trainName = TRAIN_SHORT_NAMES[train.id] || train.name;

      if (!markerEntry) {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer;';

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
          position: relative;
        `;

        const dot = document.createElement('div');
        dot.style.cssText = `width:6px; height:6px; border-radius:50%; background:${trainColor}; flex-shrink:0;`;
        pill.appendChild(dot);

        const idText = document.createElement('span');
        idText.style.cssText = `color:${theme === 'light' ? '#0f172a' : '#fff'}; font-size:9px; font-weight:700; letter-spacing:0.03em; line-height:1;`;
        idText.innerText = train.id;
        pill.appendChild(idText);

        const arrow = document.createElement('div');
        arrow.style.cssText = `
          width:0; height:0;
          transition: transform 0.5s ease;
          transform-origin: center center;
          position: absolute;
          right:-7px; top:50%; margin-top:-4px;
          border-left:7px solid ${trainColor};
          border-top:4px solid transparent;
          border-bottom:4px solid transparent;
        `;
        pill.appendChild(arrow);

        el.appendChild(pill);

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

        markerEntry = { marker, element: el, inner: pill, label, arrow };
        markersRef.current[train.id] = markerEntry;
      } else {
        markerEntry.marker.setLngLat(train.coordinates);
      }

      const pill = markerEntry.inner;
      if (pill) {
        if (train.predictedDelay > 30) {
          pill.style.borderColor = '#dc2626';
          pill.style.boxShadow = `0 0 18px rgba(220,38,38,0.5), 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'}`;
          pill.classList.remove('pulse-amber');
          pill.classList.add('pulse-red');
        } else if (train.predictedDelay > 0) {
          pill.style.borderColor = '#d97706';
          pill.style.boxShadow = `0 0 14px rgba(217,119,6,0.4), 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'}`;
          pill.classList.remove('pulse-red');
          pill.classList.add('pulse-amber');
        } else {
          pill.style.borderColor = trainColor;
          pill.style.boxShadow = `0 0 14px ${trainColor}${theme === 'light' ? '55' : '40'}, 0 2px 10px ${theme === 'light' ? 'rgba(80,60,40,0.15)' : 'rgba(0,0,0,0.5)'}`;
          pill.classList.remove('pulse-amber', 'pulse-red');
        }

        prevDelaysRef.current[train.id] = train.predictedDelay;
      }

      const arrow = markerEntry.arrow;
      if (arrow) {
        const fromCoords = STATIONS[train.currentStation]?.coordinates;
        const toCoords = STATIONS[train.nextStation]?.coordinates;
        if (fromCoords && toCoords && train.currentStation !== train.nextStation) {
          const angle = bearing(fromCoords, toCoords);
          arrow.style.transform = `rotate(${angle}deg)`;
        }
      }

      const label = markerEntry.label;
      if (label) {
        if (train.predictedDelay > 30) label.style.color = '#ef4444';
        else if (train.predictedDelay > 0) label.style.color = '#f59e0b';
        else label.style.color = trainColor;
      }

      const statusText = train.predictedDelay > 0 ? `Delayed +${train.predictedDelay}m` : 'On Schedule';
      const delayColor = train.predictedDelay > 30 ? '#ef4444' : train.predictedDelay > 0 ? '#f59e0b' : '#22c55e';
      const occupancy = Math.round((train.passengerCount / train.capacity) * 100);
      const trainRoute = getTrainRoute(train.id);
      const fromSt = trainRoute.find(s => s.id === train.currentStation);
      const toSt = trainRoute.find(s => s.id === train.nextStation);
      const fromName = fromSt?.name || train.currentStation.toUpperCase();
      const toName = toSt?.name || train.nextStation.toUpperCase();
      const currentWeather = weatherData?.[train.currentStation];
      const nextWeather = weatherData?.[train.nextStation];
      const wmoToEmoji = (desc: string) => {
        const d = desc.toLowerCase();
        if (d.includes('thunder')) return '⛈';
        if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌧';
        if (d.includes('fog') || d.includes('mist')) return '🌫';
        if (d.includes('snow')) return '❄';
        if (d.includes('cloud') || d.includes('overcast')) return '☁';
        return '☀';
      };
      const currentWeatherHtml = currentWeather
        ? `<div style="display:flex; align-items:center; gap:4px;"><span>${wmoToEmoji(currentWeather.description)}</span><span style="font-weight:600;">${currentWeather.temperature}°C</span><span style="font-size:9px;color:${theme === 'light' ? '#8a9aad' : '#666'};">${currentWeather.description}</span></div>`
        : `<span style="font-size:9px;color:${theme === 'light' ? '#8a9aad' : '#666'};">Weather unavailable</span>`;
      const nextWeatherHtml = nextWeather
        ? `<div style="display:flex; align-items:center; gap:4px;"><span>${wmoToEmoji(nextWeather.description)}</span><span style="font-weight:600;">${nextWeather.temperature}°C</span><span style="font-size:9px;color:${theme === 'light' ? '#8a9aad' : '#666'};">${nextWeather.description}</span></div>`
        : `<span style="font-size:9px;color:${theme === 'light' ? '#8a9aad' : '#666'};">Weather unavailable</span>`;

      const popupContent = `
        <div style="background:${theme === 'light' ? '#ffffff' : '#0a0a0a'}; color:${theme === 'light' ? '#1c1a17' : '#ffffff'}; font-family:system-ui,sans-serif; font-size:12px; border:1px solid ${theme === 'light' ? '#c2b9a8' : '#222'}; padding:14px; border-radius:12px; box-shadow:${theme === 'light' ? '0 8px 28px rgba(80,60,40,0.18), 0 2px 8px rgba(0,0,0,0.08)' : '0 12px 32px rgba(0,0,0,0.7)'}; min-width:200px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid ${theme === 'light' ? '#d6cec0' : '#1a1a1a'};">
            <div style="width:10px; height:10px; border-radius:50%; background:${trainColor}; flex-shrink:0; box-shadow: 0 0 6px ${trainColor}55;"></div>
            <div>
              <div style="font-weight:700; font-size:13px; color:${trainColor};">${train.name}</div>
              <div style="font-size:10px; color:${theme === 'light' ? '#6b6559' : '#555'}; font-family:monospace;">${train.id} · ${train.type} · ${train.zone}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Segment</span><span style="font-size:11px;">${fromName} → ${toName}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Speed</span><span style="font-weight:600;">${train.speed} km/h</span></div>
            <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Status</span><span style="color:${delayColor}; font-weight:700; font-size:11px; background:${delayColor}18; padding:2px 8px; border-radius:4px;">${statusText}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:${theme === 'light' ? '#6b6559' : '#666'};">Occupancy</span><span><span style="font-weight:600;">${occupancy}%</span><span style="font-size:10px;"> (${train.passengerCount.toLocaleString()}/${train.capacity.toLocaleString()})</span></span></div>
          </div>
          <div style="height:1px; background:${theme === 'light' ? '#d6cec0' : '#1a1a1a'}; margin:6px 0;"></div>
          <div style="font-weight:600; font-size:10px; color:${theme === 'light' ? '#6b6559' : '#666'}; text-transform:uppercase; margin-bottom:4px;">Weather</div>
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:4px; font-size:11px;">
              <span style="color:${theme === 'light' ? '#8a9aad' : '#666'}; min-width:44px;">${fromSt?.code || ''}</span>
              ${currentWeatherHtml}
            </div>
            <div style="display:flex; align-items:center; gap:4px; font-size:11px;">
              <span style="color:${theme === 'light' ? '#8a9aad' : '#666'}; min-width:44px;">${toSt?.code || ''}</span>
              ${nextWeatherHtml}
            </div>
          </div>
        </div>
      `;
      markerEntry.marker.getPopup().setHTML(popupContent);
    });

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

      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20" style={{ background: 'var(--color-bg-page)' }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(var(--color-border-default) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-default) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          <div className="relative flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '2px solid var(--color-border-default)', borderTopColor: 'var(--color-accent-blue)' }} />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{loadingText}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Indian Railways Network</span>
            </div>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex flex-col items-center gap-3 p-6 rounded-xl border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-default)', boxShadow: 'var(--shadow-elevated)', maxWidth: 300 }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>⚠</div>
            <div className="text-center">
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Map unavailable</div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>Could not load the map. Check your connection.</div>
            </div>
            <button onClick={() => { styleIndexRef.current = 0; setMapError(false); setMapLoaded(false); setMaplibReady(false); setTimeout(() => setMaplibReady(true), 100); }} className="px-4 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-colors" style={{ background: 'var(--color-accent-blue)', color: '#fff' }}>Retry</button>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="bg-bg-elevated/95 backdrop-blur-md border border-border-default rounded-xl px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-green" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-text-primary tracking-wide">Indian Railways Network</span>
                <span className="px-1 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider bg-accent-green-soft text-accent-green border border-accent-green/20">LIVE</span>
              </div>
              <div className="text-[9px] text-text-secondary font-mono">{trains.length} trains · {stations.length || Object.keys(STATIONS).length} stations</div>
            </div>
          </div>
        </div>

        {/* Round 2 · Ghost plan overlay toggle */}
        <button
          onClick={() => setShowGhostOverlay(v => !v)}
          className="pointer-events-auto mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-lg border border-border-default bg-bg-elevated/95 backdrop-blur-md transition-all duration-150 cursor-pointer hover:border-border-hover"
          title="Toggle the baseline plan ghost markers and drift links"
        >
          {showGhostOverlay
            ? <Eye className="w-3.5 h-3.5 text-accent-purple" />
            : <EyeOff className="w-3.5 h-3.5 text-text-tertiary" />}
          <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider ${showGhostOverlay ? 'text-text-primary' : 'text-text-tertiary'}`}>
            Ghost plan {showGhostOverlay ? 'ON' : 'OFF'}
          </span>
          {showGhostOverlay && driftReport && (
            <span className="text-[9px] font-mono text-accent-purple">
              · {driftReport.trains.filter(t => t.driftClass !== 'stable').length}
            </span>
          )}
        </button>
      </div>

      {/* Desktop Legend — collapsible */}
      <div className="absolute bottom-3 right-3 z-10 max-sm:hidden">
        {!desktopLegendOpen ? (
          <button
            onClick={() => setDesktopLegendOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl shadow-lg border border-border-default bg-bg-elevated/95 backdrop-blur-md text-text-secondary hover:text-text-primary transition-all duration-150 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-accent-blue" />
            <span className="text-[10px] font-semibold font-sans whitespace-nowrap">Legend</span>
          </button>
        ) : (
          <div className="bg-bg-elevated/95 backdrop-blur-md border border-border-default rounded-xl p-3.5 shadow-xl max-w-[200px] pointer-events-auto">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.12em]">Legend</span>
              <button
                onClick={() => setDesktopLegendOpen(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
                {TRAIN_LEGEND.map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-4 h-[3px] rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-[10px] font-medium text-text-secondary flex-1 truncate">{t.name}</span>
                    <span className="text-[9px] text-text-muted font-mono">{t.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-border-subtle">
              <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="flex-shrink-0"><path d="M1 3H9M7 1L9 3L7 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Direction of travel</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border-subtle">
              <div className="text-[8px] text-text-muted leading-tight">
                Data: Indian Railways · IRCTC schedules · Kaggle datasets
              </div>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => setShowMapLegend(true)} className="sm:hidden absolute bottom-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-2 rounded-xl shadow-lg border border-border-default transition-all duration-150 active:scale-95 cursor-pointer" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }} aria-label="Open legend">
        <Layers className="w-4 h-4 text-accent-blue" />
        <span className="text-[10px] font-semibold font-sans whitespace-nowrap">Legend</span>
      </button>

      {showMapLegend && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowMapLegend(false)} />
          <div className="fixed bottom-16 left-0 right-0 z-[70] sm:hidden max-h-[70dvh] bg-bg-elevated/95 backdrop-blur-md border-t border-border-default rounded-t-2xl shadow-2xl p-4 animate-slide-up overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-text-primary uppercase tracking-[0.12em]">Legend</span>
              <button onClick={() => setShowMapLegend(false)} className="text-text-tertiary hover:text-text-primary cursor-pointer"><svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
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
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                    <span className="text-[10px] font-medium text-text-secondary">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-px bg-border-default my-2.5" />
            <div className="mb-3">
              <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.12em] mb-2">Trains</div>
              <div className="flex flex-col gap-1.5">
                {TRAIN_LEGEND.map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-4 h-[3px] rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-[10px] font-medium text-text-secondary flex-1 truncate">{t.name}</span>
                    <span className="text-[9px] text-text-muted font-mono">{t.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-border-subtle">
              <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary mb-1">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="flex-shrink-0"><path d="M1 3H9M7 1L9 3L7 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Direction of travel</span>
              </div>
              <div className="text-[8px] text-text-muted mt-1">Data: IRCTC · Kaggle</div>
            </div>
          </div>
        </>
      )}

      {/* Desktop Live Weather HUD */}
      <div className="absolute bottom-3 left-3 z-10 max-sm:hidden">
        <div className="bg-bg-elevated/95 backdrop-blur-md border border-border-default rounded-xl p-3 shadow-xl w-[280px] flex flex-col gap-2.5 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider font-sans">Live Weather</span>
              {(() => {
                if (!weatherData) return null;
                const allLive = Object.values(weatherData).every((w: any) => w?.source === 'live');
                return allLive
                  ? <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-accent-green-soft text-accent-green border border-accent-green/20">LIVE</span>
                  : <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-accent-amber-soft text-accent-amber border border-accent-amber/20">FALLBACK</span>;
              })()}
            </div>
            {weatherData && Object.values(weatherData).length > 0 && (() => {
              const times = Object.values(weatherData).filter(Boolean).map((w: any) => new Date(w.fetchedAt).getTime());
              const maxTime = times.length ? Math.max(...times) : 0;
              const stamp = maxTime ? new Date(maxTime).toLocaleTimeString() : '';
              return stamp ? `<span class="text-[8px] text-text-muted font-mono">${stamp}</span>` : '';
            })() && (
              <span className="text-[8px] text-text-muted font-mono">
                {(() => {
                  const times = Object.values(weatherData).filter(Boolean).map((w: any) => new Date(w.fetchedAt).getTime());
                  const maxTime = times.length ? Math.max(...times) : 0;
                  return maxTime ? new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                })()}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
            {(stations.length ? stations : ALL_STATIONS).map(s => {
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
                    <span className="text-text-tertiary truncate max-w-[65px]">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className={weatherColor} title={w ? w.description : 'Unknown'}>{weatherEmoji}</span>
                    <span className="text-text-secondary font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{w ? `${w.temperature}°` : '--'}</span>
                    <span className="text-[9px] text-text-muted select-none">|</span>
                    <span className="text-text-secondary w-14" style={{ fontVariantNumeric: 'tabular-nums' }}>{hasRain ? `${w.rainfall}mm` : w ? `${w.visibility}km` : '--'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <button onClick={() => setShowLiveWeather(true)} className="sm:hidden absolute bottom-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-2 rounded-xl shadow-lg border border-border-default transition-all duration-150 active:scale-95 cursor-pointer" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }} aria-label="Open weather">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="text-accent-blue"><path d="M3 6h6M6 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span className="text-[10px] font-semibold font-sans whitespace-nowrap">Live Weather</span>
      </button>
      {showLiveWeather && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLiveWeather(false)} />
          <div className="fixed bottom-16 left-0 right-0 z-[70] sm:hidden max-h-[70dvh] bg-bg-elevated/95 backdrop-blur-md border-t border-border-default rounded-t-2xl shadow-2xl p-4 animate-slide-up flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Live Weather</span>
                {(() => {
                  if (!weatherData) return null;
                  const allLive = Object.values(weatherData).every((w: any) => w?.source === 'live');
                  return allLive
                    ? <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-accent-green-soft text-accent-green border border-accent-green/20">LIVE</span>
                    : <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-accent-amber-soft text-accent-amber border border-accent-amber/20">FALLBACK</span>;
                })()}
              </div>
              <button onClick={() => setShowLiveWeather(false)} className="text-text-tertiary hover:text-text-primary cursor-pointer"><svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5 scrollbar-thin">
              {(stations.length ? stations : ALL_STATIONS).map(s => {
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
                    className="group flex items-center justify-between px-2 py-1.5 rounded bg-bg-sunken hover:bg-bg-hover border border-border-subtle hover:border-border-default transition-all duration-150 cursor-pointer text-[10px] font-mono" title="Click to focus station on map">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-text-primary group-hover:text-accent-blue transition-colors">{s.code}</span>
                      <span className="text-text-tertiary truncate max-w-[65px]">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className={weatherColor} title={w ? w.description : 'Unknown'}>{weatherEmoji}</span>
                      <span className="text-text-secondary font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{w ? `${w.temperature}°` : '--'}</span>
                      <span className="text-[9px] text-text-muted select-none">|</span>
                      <span className="text-text-secondary w-14" style={{ fontVariantNumeric: 'tabular-nums' }}>{hasRain ? `${w.rainfall}mm` : w ? `${w.visibility}km` : '--'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
