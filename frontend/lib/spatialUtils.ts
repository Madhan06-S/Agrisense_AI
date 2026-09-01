/**
 * Spatial Utilities for Farm Boundary and Land Identification
 */

export interface FarmerCurrentLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export interface InsuredFarmLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * Calculates Haversine distance in meters between two lat/lng points.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Returns an informative status badge message if current GPS is far from insured farm location.
 * Does NOT block registration.
 */
export function evaluateLocationDistanceStatus(
  currentGps: FarmerCurrentLocation | null,
  farmLocation: InsuredFarmLocation | null
): { isAway: boolean; message: string | null; distanceMeters: number | null } {
  if (
    !currentGps ||
    currentGps.latitude === null ||
    currentGps.longitude === null ||
    !farmLocation
  ) {
    return { isAway: false, message: null, distanceMeters: null };
  }

  const dist = calculateHaversineDistance(
    currentGps.latitude,
    currentGps.longitude,
    farmLocation.latitude,
    farmLocation.longitude
  );

  if (dist > 1000) {
    return {
      isAway: true,
      distanceMeters: dist,
      message: "ℹ️ You are currently away from this farm. That's okay.",
    };
  }

  return { isAway: false, distanceMeters: dist, message: null };
}

/**
 * Calculates the 2D centroid [lat, lng] of a polygon.
 */
export function calculatePolygonCentroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  const sumLat = points.reduce((acc, p) => acc + p[0], 0);
  const sumLng = points.reduce((acc, p) => acc + p[1], 0);
  return [sumLat / points.length, sumLng / points.length];
}

/**
 * Ray-casting algorithm to test if a point [lat, lng] is inside a polygon [ [lat, lng], ... ].
 */
export function isPointInPolygon(
  point: [number, number],
  vs: [number, number][]
): boolean {
  if (vs.length < 3) return false;
  const x = point[0];
  const y = point[1];

  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0],
      yi = vs[i][1];
    const xj = vs[j][0],
      yj = vs[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Helper to determine if two 2D line segments (p1-p2) and (p3-p4) intersect.
 */
export function doLineSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  function CCW(
    a: [number, number],
    b: [number, number],
    c: [number, number]
  ): boolean {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  }
  return (
    CCW(p1, p3, p4) !== CCW(p2, p3, p4) && CCW(p1, p2, p3) !== CCW(p1, p2, p4)
  );
}

/**
 * Tests if a polygon [ [lat, lng], ... ] self-intersects.
 */
export function isPolygonSelfIntersecting(points: [number, number][]): boolean {
  if (points.length < 4) return false;

  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;

      const p3 = points[j];
      const p4 = points[(j + 1) % n];

      if (doLineSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculates polygon area in Hectares from [ [lat, lng], ... ]
 */
export function calculatePolygonAreaHectares(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  const meanLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const meanLatRad = (meanLat * Math.PI) / 180;

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];

    const x1 = p1[1] * 111132 * Math.cos(meanLatRad);
    const y1 = p1[0] * 111132;
    const x2 = p2[1] * 111132 * Math.cos(meanLatRad);
    const y2 = p2[0] * 111132;

    area += x1 * y2 - x2 * y1;
  }

  const areaHa = Math.abs(area / 2) / 10000;
  return Math.round(areaHa * 100) / 100;
}

/**
 * Converts hectares to acres (1 ha = 2.47105 acres)
 */
export function calculateAreaAcres(hectares: number): number {
  return Math.round(hectares * 2.47105 * 100) / 100;
}

/**
 * Checks if two polygons overlap by testing vertex-in-polygon and edge segment intersections.
 */
export function doPolygonsOverlap(
  poly1: [number, number][],
  poly2: [number, number][]
): boolean {
  if (poly1.length < 3 || poly2.length < 3) return false;

  for (const pt of poly1) {
    if (isPointInPolygon(pt, poly2)) return true;
  }

  for (const pt of poly2) {
    if (isPointInPolygon(pt, poly1)) return true;
  }

  const n1 = poly1.length;
  const n2 = poly2.length;

  for (let i = 0; i < n1; i++) {
    const a1 = poly1[i];
    const a2 = poly1[(i + 1) % n1];

    for (let j = 0; j < n2; j++) {
      const b1 = poly2[j];
      const b2 = poly2[(j + 1) % n2];

      if (doLineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}
