import type { Tetri } from './money';

export type LatLng = { lat: number; lng: number };

export type DeliveryZone = {
  id: string;
  name: string;
  sortOrder: number;
  feeTetri: Tetri | null;
  minOrderTetri: Tetri | null;
} & (
  | { kind: 'radius'; radiusKm: number }
  | { kind: 'polygon'; polygon: [number, number][] } // [lat, lng] points
);

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray casting. Fine for city-sized polygons. */
export function isInPolygon(point: LatLng, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i]!;
    const [latJ, lngJ] = polygon[j]!;
    const crosses =
      lngI > point.lng !== lngJ > point.lng &&
      point.lat < ((latJ - latI) * (point.lng - lngI)) / (lngJ - lngI) + latI;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * The first matching zone in sort order, so an inner "0–3 km" zone can sit
 * before a wider "3–6 km" one with a higher fee.
 */
export function findDeliveryZone(
  point: LatLng,
  restaurant: LatLng,
  zones: DeliveryZone[],
): { zone: DeliveryZone; distanceKm: number } | null {
  const distance = distanceKm(restaurant, point);
  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const zone of sorted) {
    const inside =
      zone.kind === 'radius' ? distance <= zone.radiusKm : isInPolygon(point, zone.polygon);
    if (inside) return { zone, distanceKm: Math.round(distance * 100) / 100 };
  }
  return null;
}
