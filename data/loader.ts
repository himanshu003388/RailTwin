import type { StationData, TrainRoute, HistoricalDelay } from './types';

/**
 * Loads station data from the JSON dataset.
 * Dynamic imports of 'fs' and 'path' are used to prevent bundler errors
 * in client-side contexts, while providing fast server-side loading.
 */
export async function loadStationData(): Promise<StationData[]> {
  if (typeof window !== 'undefined') {
    // Client-side execution context: fetch from served JSON path
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const response = await fetch(`${normalizedBase}data/station_data.json`);
    if (!response.ok) throw new Error('Failed to fetch station data from client');
    return response.json();
  }

  // Server-side execution context: read directly from the filesystem
  const fs = await import('fs');
  const path = await import('path');
  const filePath = path.join(process.cwd(), 'data', 'station_data.json');
  const fileContent = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
}

/**
 * Loads train routes stop sequences and capacities.
 */
export async function loadTrainRoutes(): Promise<TrainRoute[]> {
  if (typeof window !== 'undefined') {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const response = await fetch(`${normalizedBase}data/train_routes.json`);
    if (!response.ok) throw new Error('Failed to fetch train routes from client');
    return response.json();
  }

  const fs = await import('fs');
  const path = await import('path');
  const filePath = path.join(process.cwd(), 'data', 'train_routes.json');
  const fileContent = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
}

/**
 * Loads historical train delays logs.
 */
export async function loadHistoricalDelays(): Promise<HistoricalDelay[]> {
  if (typeof window !== 'undefined') {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const response = await fetch(`${normalizedBase}data/historical_delays.json`);
    if (!response.ok) throw new Error('Failed to fetch historical delays from client');
    return response.json();
  }

  const fs = await import('fs');
  const path = await import('path');
  const filePath = path.join(process.cwd(), 'data', 'historical_delays.json');
  const fileContent = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
}
