import React, { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../../stores/demoStore';
import { CORRIDOR } from '../../data/corridor';

declare global {
  const maplibregl: any;
}

// Helper function to generate a circle polygon in GeoJSON format
function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64) {
  const [lng, lat] = center;
  const coords: number[][] = [];
  const km = radiusInKm;

  // 1 degree of latitude is ~110.57km
  // 1 degree of longitude is ~111.32km * cos(latitude)
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.57;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // Close the polygon

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    }
  };
}

// Function to generate the stations GeoJSON features styled by risk
const getStationsGeoJSON = (stationRisks: any) => {
  return {
    type: 'FeatureCollection',
    features: CORRIDOR.stations.map(station => {
      const risks = stationRisks[station.id] || { crowdRisk: 'low', delayRisk: 'low', platformConflicts: 0 };
      // Map crowdRisk to the designated colors
      let color = '#22c55e'; // low
      if (risks.crowdRisk === 'moderate') color = '#f59e0b'; // amber
      else if (risks.crowdRisk === 'high') color = '#f97316'; // orange
      else if (risks.crowdRisk === 'critical') color = '#ef4444'; // red

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
        geometry: {
          type: 'Point',
          coordinates: station.coordinates
        }
      };
    })
  };
};

export const CorridorMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Subscribe to store updates
  const trains = useDemoStore(state => state.trains);
  const stationRisks = useDemoStore(state => state.stationRisks);
  const weatherAlert = useDemoStore(state => state.weatherAlert);
  const activePanel = useDemoStore(state => state.activePanel);
  const demoTime = useDemoStore(state => state.demoTime);

  // References to track markers
  const markersRef = useRef<Record<string, { marker: any; element: HTMLDivElement; inner?: HTMLDivElement }>>({});
  // References to track previous delays
  const prevDelaysRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!mapContainer.current) return;

    // Check if maplibregl is loaded globally
    if (typeof maplibregl === 'undefined') {
      console.error('MapLibre GL JS not found in global scope.');
      return;
    }

    // Initialize MapLibre Map
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [84.0, 25.5],
      zoom: 5.5,
      attributionControl: false // Hide attribution
    });

    mapRef.current = map;

    // Disable scroll zoom on mobile
    if (window.innerWidth <= 768) {
      map.scrollZoom.disable();
    }

    map.on('load', () => {
      setMapLoaded(true);

      // --- LAYER 1: Corridor Route Line ---
      const sortedStations = [...CORRIDOR.stations].sort((a, b) => a.kmFromOrigin - b.kmFromOrigin);
      const routeCoordinates = sortedStations.map(s => s.coordinates);

      map.addSource('corridor-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates
          }
        }
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'corridor-route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 3]
        }
      });

      // --- LAYER 2: Station Circle Layer ---
      map.addSource('stations', {
        type: 'geojson',
        data: getStationsGeoJSON(useDemoStore.getState().stationRisks)
      });

      map.addLayer({
        id: 'station-circles',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });

      // Station code labels below marker
      map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        layout: {
          'text-field': ['get', 'code'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-width': 0
        }
      });

      // Click event for station popups
      map.on('click', 'station-circles', (e: any) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { name, crowdRisk, conflicts, platforms } = e.features[0].properties;

        const html = `
          <div style="background-color: #111111; color: #ffffff; font-family: 'Geist Mono', monospace; font-size: 11px; border: 1px solid #222222; padding: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <div style="font-weight: bold; margin-bottom: 6px; color: #3b82f6; border-bottom: 1px solid #222222; padding-bottom: 4px;">${name}</div>
            <div style="margin-bottom: 3px;">Crowd Risk: <span style="color: ${
              crowdRisk === 'critical' ? '#ef4444' : crowdRisk === 'high' ? '#f97316' : crowdRisk === 'moderate' ? '#f59e0b' : '#22c55e'
            }; font-weight: bold;">${crowdRisk.toUpperCase()}</span></div>
            <div style="margin-bottom: 3px;">Active Conflicts: <span style="font-weight: bold; color: ${conflicts > 0 ? '#ef4444' : '#22c55e'}">${conflicts}</span></div>
            <div>Platforms: <span style="color: #ffffff;">${platforms}</span></div>
          </div>
        `;

        new maplibregl.Popup({ closeButton: false, offset: 10 })
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      // Cursor adjustments on station hover
      map.on('mouseenter', 'station-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'station-circles', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      // Remove map elements and cleanup
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      markersRef.current = {};
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync Station risks on updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource('stations');
    if (source) {
      source.setData(getStationsGeoJSON(stationRisks));
    }
  }, [stationRisks, mapLoaded]);

  // Trigger smooth flyTo animations at key demo moments
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (demoTime === 4) {
      // t=4: flyTo Patna Junction (zoom to 8, 1500ms)
      const pnbeStation = CORRIDOR.stations.find(s => s.id === 'pnbe');
      if (pnbeStation) {
        map.flyTo({
          center: pnbeStation.coordinates,
          zoom: 8.0,
          duration: 1500
        });
      }
    } else if (demoTime === 12) {
      // t=12: flyTo center corridor (zoom back to 5.5, 1000ms)
      map.flyTo({
        center: [84.0, 25.5],
        zoom: 5.5,
        duration: 1000
      });
    } else if (demoTime === 42) {
      // t=42: flyTo Patna (zoom 7, to show resolved state, 1200ms)
      const pnbeStation = CORRIDOR.stations.find(s => s.id === 'pnbe');
      if (pnbeStation) {
        map.flyTo({
          center: pnbeStation.coordinates,
          zoom: 7.0,
          duration: 1200
        });
      }
    }
  }, [demoTime, mapLoaded]);

  // Resize and zoom map based on activePanel configuration
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    setTimeout(() => {
      map.resize();
      
      // Prevent easeTo conflicts with our timeline flyTo animations at t=12
      const currentDemoTime = useDemoStore.getState().demoTime;
      const currentDemoRunning = useDemoStore.getState().demoRunning;
      if (currentDemoRunning && currentDemoTime === 12) {
        return;
      }

      if (activePanel !== 'map') {
        map.easeTo({
          zoom: 5.0,
          center: [84.0, 25.5],
          duration: 350
        });
      } else {
        map.easeTo({
          zoom: 5.5,
          center: [84.0, 25.5],
          duration: 350
        });
      }
    }, 150);
  }, [activePanel, mapLoaded]);

  // Sync Train positions and styles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    trains.forEach(train => {
      let markerEntry = markersRef.current[train.id];

      if (!markerEntry) {
        // Create new HTML Marker element
        const el = document.createElement('div');
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.position = 'relative';

        const inner = document.createElement('div');
        inner.className = 'flex items-center justify-center rounded-full text-white font-mono text-[9px] font-bold shadow-lg transition-all duration-300 cursor-pointer w-full h-full';
        inner.style.backgroundColor = '#111111';
        inner.innerText = train.id;
        el.appendChild(inner);

        const popup = new maplibregl.Popup({ closeButton: false, offset: 15 });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(train.coordinates)
          .setPopup(popup)
          .addTo(map);

        markerEntry = { marker, element: el, inner: inner };
        markersRef.current[train.id] = markerEntry;
      } else {
        // Reposition active marker
        markerEntry.marker.setLngLat(train.coordinates);
      }

      // Update styling states
      const inner = markerEntry.inner || markerEntry.element.querySelector('div');
      if (inner) {
        if (train.predictedDelay > 30) {
          inner.style.border = '2px solid #ef4444';
          inner.classList.remove('pulse-amber');
          inner.classList.add('pulse-red');
        } else if (train.predictedDelay > 0) {
          inner.style.border = '2px solid #f59e0b';
          inner.classList.remove('pulse-red');
          inner.classList.add('pulse-amber');
        } else {
          inner.style.border = '2px solid #3b82f6';
          inner.classList.remove('pulse-amber', 'pulse-red');
        }

        // Trigger bounce animation when delay updates
        const prevDelay = prevDelaysRef.current[train.id];
        if (prevDelay !== undefined && prevDelay !== train.predictedDelay) {
          inner.classList.add('bounce-marker');
          setTimeout(() => {
            inner.classList.remove('bounce-marker');
          }, 600);
        }
        prevDelaysRef.current[train.id] = train.predictedDelay;
      }

      // Setup/update popup contents
      const statusText = train.predictedDelay > 0
        ? `Delayed +${train.predictedDelay}m`
        : 'On Schedule';
      const delayColor = train.predictedDelay > 30
        ? '#ef4444'
        : train.predictedDelay > 0
        ? '#f59e0b'
        : '#22c55e';

      const popupContent = `
        <div style="background-color: #111111; color: #ffffff; font-family: 'Geist Mono', monospace; font-size: 11px; border: 1px solid #222222; padding: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <div style="font-weight: bold; color: #3b82f6; margin-bottom: 6px; border-bottom: 1px solid #222222; padding-bottom: 4px;">${train.name} (${train.id})</div>
          <div style="margin-bottom: 3px;">Type: <span style="text-transform: capitalize; color: #888888;">${train.type}</span></div>
          <div style="margin-bottom: 3px;">Speed: <span style="color: #ffffff;">${train.speed} km/h</span></div>
          <div style="margin-bottom: 3px;">Route: <span style="color: #888888;">${train.currentStation.toUpperCase()}</span> → <span style="color: #888888;">${train.nextStation.toUpperCase()}</span></div>
          <div style="margin-bottom: 3px;">Status: <span style="color: ${delayColor}; font-weight: bold;">${statusText}</span></div>
          <div>Occupancy: <span style="color: #ffffff;">${train.passengerCount} / ${train.capacity} (${Math.round((train.passengerCount / train.capacity) * 100)}%)</span></div>
        </div>
      `;
      markerEntry.marker.getPopup().setHTML(popupContent);
    });
  }, [trains, mapLoaded]);

  // Sync Weather Overlay alert
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = 'weather-circle';
    const fillLayerId = 'weather-fill';
    const borderLayerId = 'weather-border';

    // Remove layer/source if existing
    const cleanupLayers = () => {
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };

    cleanupLayers();

    if (weatherAlert && weatherAlert.station === 'pnbe') {
      const pnbeStation = CORRIDOR.stations.find(s => s.id === 'pnbe');
      if (pnbeStation) {
        const circleData = createGeoJSONCircle(pnbeStation.coordinates, 20);

        map.addSource(sourceId, {
          type: 'geojson',
          data: circleData
        });

        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#ef4444',
            'fill-opacity': 0.15
          }
        });

        map.addLayer({
          id: borderLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#ef4444',
            'line-width': 1,
            'line-opacity': 0.8
          }
        });

        // Cosine wave pulsing effect
        let startTime = Date.now();
        const pulseInterval = setInterval(() => {
          if (!mapRef.current || !mapRef.current.getLayer(fillLayerId)) {
            clearInterval(pulseInterval);
            return;
          }
          const elapsed = Date.now() - startTime;
          const opacity = 0.15 + 0.05 * Math.cos((elapsed / 2000) * 2 * Math.PI);
          mapRef.current.setPaintProperty(fillLayerId, 'fill-opacity', opacity);
        }, 50);

        return () => {
          clearInterval(pulseInterval);
          cleanupLayers();
        };
      }
    }
  }, [weatherAlert, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      {/* Styles insertion for train markers animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes train-pulse-amber {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes train-pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .pulse-amber {
          animation: train-pulse-amber 2s infinite;
        }
        .pulse-red {
          animation: train-pulse-red 1.5s infinite;
        }
        @keyframes marker-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .bounce-marker {
          animation: marker-bounce 0.6s ease-out;
        }
      ` }} />

      {/* Mapbox/MapLibre container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Map Legend */}
      <div className="absolute bottom-4 right-4 bg-[#111111]/90 border border-[#222222] rounded-lg p-3 font-mono text-[11px] text-white pointer-events-none select-none z-10">
        <div className="font-bold border-b border-[#222222] pb-1.5 mb-1.5 text-text-secondary">Risk Level</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] inline-block border border-white/20" />
            <span>Low Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block border border-white/20" />
            <span>Moderate Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] inline-block border border-white/20" />
            <span>High Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block border border-white/20" />
            <span>Critical Risk</span>
          </div>
        </div>
      </div>
    </div>
  );
};
