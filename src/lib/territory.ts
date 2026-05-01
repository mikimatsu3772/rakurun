import type { LatLng, RunPoint } from '../types';
import { haversineMeters, polygonAreaMeters } from './geo';

const CLOSE_LOOP_THRESHOLD_M = 30;
const MIN_POINTS_FOR_TERRITORY = 8;

// Detect whether a run forms a closed loop. If the runner returns close to a
// previous point, we treat the enclosed region as a candidate territory.
export function detectClosedLoop(points: RunPoint[]): LatLng[] | null {
  if (points.length < MIN_POINTS_FOR_TERRITORY) return null;

  const last = points[points.length - 1];
  for (let i = 0; i < points.length - MIN_POINTS_FOR_TERRITORY; i++) {
    if (haversineMeters(points[i], last) < CLOSE_LOOP_THRESHOLD_M) {
      return points.slice(i).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));
    }
  }
  return null;
}

export function territoryAreaMeters(polygon: LatLng[]): number {
  return polygonAreaMeters(polygon);
}
