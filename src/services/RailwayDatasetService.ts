/**
 * RailwayDatasetService
 *
 * A singleton service that loads and caches the three open railway datasets:
 *   - train_routes.json
 *   - station_data.json
 *   - historical_delays.json
 *
 * Works in both:
 *   - Server-side (Node.js / Vercel serverless) — reads from the filesystem
 *   - Client-side (browser) — fetches over HTTP from /data/*
 *
 * Usage:
 *   const svc = RailwayDatasetService.getInstance();
 *   const routes  = await svc.getTrainRoutes();
 *   const stats   = await svc.getDelayStats('12301');
 */

import type { TrainRoute, StationData, HistoricalDelay } from '../../data/types';

// ─── Richer derived types ──────────────────────────────────────────────────

/** Statistics computed from historical delay records for a single train */
export interface TrainDelayStats {
  trainNo: string;
  /** Total number of historical delay records found */
  recordCount: number;
  /** Average delay across all records (minutes) */
  avgDelay: number;
  /** Minimum delay recorded (minutes) */
  minDelay: number;
  /** Maximum delay recorded (minutes) */
  maxDelay: number;
  /** Worst weather condition (by highest avgDelay) */
  worstWeather: string;
  /** Month with the highest recorded average delay */
  worstMonth: string;
  /** Delay broken down by weather condition */
  byWeather: Record<string, number>;
  /** Delay broken down by month */
  byMonth: Record<string, number>;
}

/** Station data enriched with computed fields */
export interface EnrichedStation extends StationData {
  /** Lowercase id used internally (e.g. "ndls") */
  id: string;
  /** GeoJSON-compatible [lng, lat] coordinate pair */
  coordinates: [number, number];
}

// ─── Service ──────────────────────────────────────────────────────────────

export class RailwayDatasetService {
  private static instance: RailwayDatasetService | null = null;

  // In-memory cache — populated on first load, reused on subsequent calls
  private routesCache: TrainRoute[] | null = null;
  private stationsCache: StationData[] | null = null;
  private delaysCache: HistoricalDelay[] | null = null;

  // Dataset base path for server-side reads
  private readonly dataDir: string;

  private constructor() {
    // Resolve data directory relative to the project root
    this.dataDir = typeof process !== 'undefined' ? 'data' : '/data';
  }

  /** Returns the singleton instance */
  static getInstance(): RailwayDatasetService {
    if (!RailwayDatasetService.instance) {
      RailwayDatasetService.instance = new RailwayDatasetService();
    }
    return RailwayDatasetService.instance;
  }

  /** Clears all cached datasets (useful for hot-reloading in dev) */
  invalidateCache(): void {
    this.routesCache = null;
    this.stationsCache = null;
    this.delaysCache = null;
  }

  // ─── Private loaders ────────────────────────────────────────────────────

  private async loadJson<T>(filename: string): Promise<T> {
    if (typeof window === 'undefined') {
      // ── Server-side: read from filesystem ──────────────────────────────
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), this.dataDir, filename);
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } else {
      // ── Client-side: fetch over HTTP ────────────────────────────────────
      const res = await fetch(`/${this.dataDir}/${filename}`);
      if (!res.ok) {
        throw new Error(
          `RailwayDatasetService: failed to fetch ${filename} (${res.status} ${res.statusText})`
        );
      }
      return res.json() as Promise<T>;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Returns all train routes loaded from train_routes.json.
   * Results are cached after the first call.
   */
  async getTrainRoutes(): Promise<TrainRoute[]> {
    if (!this.routesCache) {
      this.routesCache = await this.loadJson<TrainRoute[]>('train_routes.json');
    }
    return this.routesCache;
  }

  /**
   * Returns all stations loaded from station_data.json.
   * Results are cached after the first call.
   */
  async getStations(): Promise<StationData[]> {
    if (!this.stationsCache) {
      this.stationsCache = await this.loadJson<StationData[]>('station_data.json');
    }
    return this.stationsCache;
  }

  /**
   * Returns all historical delay records loaded from historical_delays.json.
   * Results are cached after the first call.
   */
  async getHistoricalDelays(): Promise<HistoricalDelay[]> {
    if (!this.delaysCache) {
      this.delaysCache = await this.loadJson<HistoricalDelay[]>('historical_delays.json');
    }
    return this.delaysCache;
  }

  /**
   * Returns aggregated delay statistics for a specific train number.
   *
   * @param trainNo - e.g. "12301"
   * @returns TrainDelayStats or null if no records found for that train
   *
   * @example
   * const stats = await svc.getDelayStats('12301');
   * // { trainNo: '12301', recordCount: 2, avgDelay: 32, worstWeather: 'Fog', ... }
   */
  async getDelayStats(trainNo: string): Promise<TrainDelayStats | null> {
    const all = await this.getHistoricalDelays();
    const records = all.filter(d => d.trainNo === trainNo);

    if (records.length === 0) return null;

    // Aggregate by weather
    const byWeather: Record<string, number[]> = {};
    const byMonth: Record<string, number[]> = {};

    for (const r of records) {
      if (!byWeather[r.weather]) byWeather[r.weather] = [];
      byWeather[r.weather].push(r.avgDelay);

      if (!byMonth[r.month]) byMonth[r.month] = [];
      byMonth[r.month].push(r.avgDelay);
    }

    const avgOfGroup = (group: Record<string, number[]>): Record<string, number> =>
      Object.fromEntries(
        Object.entries(group).map(([key, vals]) => [
          key,
          Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        ])
      );

    const weatherAvgs = avgOfGroup(byWeather);
    const monthAvgs = avgOfGroup(byMonth);

    const allDelays = records.map(r => r.avgDelay);
    const overallAvg = Math.round(allDelays.reduce((a, b) => a + b, 0) / allDelays.length);

    const worstWeather = Object.entries(weatherAvgs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const worstMonth = Object.entries(monthAvgs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    return {
      trainNo,
      recordCount: records.length,
      avgDelay: overallAvg,
      minDelay: Math.min(...allDelays),
      maxDelay: Math.max(...allDelays),
      worstWeather,
      worstMonth,
      byWeather: weatherAvgs,
      byMonth: monthAvgs
    };
  }

  /**
   * Convenience: returns a station by its IATA/IR code (case-insensitive).
   * Returns undefined if not found.
   *
   * @example
   * const ndls = await svc.getStationByCode('NDLS');
   */
  async getStationByCode(code: string): Promise<StationData | undefined> {
    const stations = await this.getStations();
    return stations.find(s => s.code.toUpperCase() === code.toUpperCase());
  }

  /**
   * Convenience: returns a train route by its train number.
   * Returns undefined if not found.
   *
   * @example
   * const route = await svc.getRouteByTrainNo('12301');
   */
  async getRouteByTrainNo(trainNo: string): Promise<TrainRoute | undefined> {
    const routes = await this.getTrainRoutes();
    return routes.find(r => r.trainNo === trainNo);
  }

  /**
   * Returns stations enriched with a lowercase `id` and a GeoJSON
   * `coordinates` array — ready to be fed into MapLibre GL or Leaflet.
   *
   * @example
   * const enriched = await svc.getEnrichedStations();
   * enriched[0].coordinates // [77.219, 28.6428]
   */
  async getEnrichedStations(): Promise<EnrichedStation[]> {
    const stations = await this.getStations();
    return stations.map(s => ({
      ...s,
      id: s.code.toLowerCase(),
      coordinates: [s.lng, s.lat] as [number, number]
    }));
  }

  /**
   * Returns delay stats for ALL trains in one batch call.
   * Trains with no historical records are excluded from the result.
   *
   * @example
   * const allStats = await svc.getAllDelayStats();
   */
  async getAllDelayStats(): Promise<TrainDelayStats[]> {
    const routes = await this.getTrainRoutes();
    const results = await Promise.all(routes.map(r => this.getDelayStats(r.trainNo)));
    return results.filter((s): s is TrainDelayStats => s !== null);
  }
}

// ─── Convenience singleton export ─────────────────────────────────────────

/**
 * Pre-initialised singleton — import this directly for one-line usage:
 *
 * ```ts
 * import { railwayDataset } from '@/services/RailwayDatasetService';
 * const routes = await railwayDataset.getTrainRoutes();
 * ```
 */
export const railwayDataset = RailwayDatasetService.getInstance();
