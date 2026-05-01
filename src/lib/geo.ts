import type { LatLng } from '../types';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function totalDistanceMeters(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineMeters(points[i - 1], points[i]);
  }
  return sum;
}

// Approximate area of a polygon on a sphere using the spherical excess formula.
// Returns square meters. Polygon should be a closed ring of LatLng (last point
// may or may not equal the first; either is fine).
export function polygonAreaMeters(polygon: LatLng[]): number {
  if (polygon.length < 3) return 0;

  let total = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    total +=
      toRadians(p2.longitude - p1.longitude) *
      (2 + Math.sin(toRadians(p1.latitude)) + Math.sin(toRadians(p2.latitude)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}
