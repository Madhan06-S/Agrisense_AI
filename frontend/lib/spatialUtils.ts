/**
 * Spatial Utilities for AgriSense AI Farm Boundary Mapping
 */

/**
 * Calculate Haversine distance between two [lat, lng] points in meters.
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
  return Math.round(R * c * 100) / 100; // meters rounded to 2 decimals
}

/**
 * Ray-casting algorithm to test if a point [lat, lng] is inside a polygon points [[lat, lng], ...].
 */
export function isPointInPolygon(
  point: [number, number],
  vs: [number, number][]
): boolean {
  if (!vs || vs.length < 3) return false;
  const x = point[1]; // lng
  const y = point[0]; // lat

  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1],
      yi = vs[i][0];
    const xj = vs[j][1],
      yj = vs[j][0];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if two line segments (p1-p2 and p3-p4) intersect.
 */
function lineSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const ccw = (
    a: [number, number],
    b: [number, number],
    c: [number, number]
  ) => {
    return (c[0] - a[0]) * (b[1] - a[1]) > (b[0] - a[0]) * (c[1] - a[1]);
  };

  // Exclude endpoints sharing
  if (
    (p1[0] === p3[0] && p1[1] === p3[1]) ||
    (p1[0] === p4[0] && p1[1] === p4[1]) ||
    (p2[0] === p3[0] && p2[1] === p3[1]) ||
    (p2[0] === p4[0] && p2[1] === p4[1])
  ) {
    return false;
  }

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Check if a polygon with points [[lat, lng], ...] has self-intersecting edges.
 */
export function isPolygonSelfIntersecting(points: [number, number][]): boolean {
  if (!points || points.length < 4) return false;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      // Don't check adjacent segments
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;

      const p3 = points[j];
      const p4 = points[(j + 1) % n];

      if (lineSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Convert Hectares to Acres (1 ha = 2.47105 acres).
 */
export function hectaresToAcres(hectares: number): number {
  return Math.round(hectares * 2.47105 * 100) / 100;
}

/**
 * Polygon Overlap Detection
 * Checks if poly1 [[lat, lng]] intersects or overlaps poly2 [[lat, lng]].
 * Returns overlap status and estimated overlap percentage.
 */
export interface OverlapResult {
  hasOverlap: boolean;
  overlapType: "NONE" | "PARTIAL" | "SIGNIFICANT";
  overlappingFarmIds: number[];
  maxOverlapPercentage: number;
}

export function checkPolygonOverlap(
  newPoly: [number, number][],
  existingFarms: { id: number; name: string; coordinates: [number, number][] }[]
): OverlapResult {
  if (!newPoly || newPoly.length < 3) {
    return {
      hasOverlap: false,
      overlapType: "NONE",
      overlappingFarmIds: [],
      maxOverlapPercentage: 0,
    };
  }

  const overlappingIds: number[] = [];
  let maxPercentage = 0;

  for (const farm of existingFarms) {
    if (!farm.coordinates || farm.coordinates.length < 3) continue;

    let pointsInside = 0;
    // Check points of newPoly inside existing farm
    for (const pt of newPoly) {
      if (isPointInPolygon(pt, farm.coordinates)) {
        pointsInside++;
      }
    }

    // Check points of existing farm inside newPoly
    let existingInside = 0;
    for (const pt of farm.coordinates) {
      if (isPointInPolygon(pt, newPoly)) {
        existingInside++;
      }
    }

    // Check edge intersections
    let edgeIntersects = false;
    const n1 = newPoly.length;
    const n2 = farm.coordinates.length;
    for (let i = 0; i < n1; i++) {
      const p1 = newPoly[i];
      const p2 = newPoly[(i + 1) % n1];
      for (let j = 0; j < n2; j++) {
        const p3 = farm.coordinates[j];
        const p4 = farm.coordinates[(j + 1) % n2];
        if (lineSegmentsIntersect(p1, p2, p3, p4)) {
          edgeIntersects = true;
          break;
        }
      }
      if (edgeIntersects) break;
    }

    if (pointsInside > 0 || existingInside > 0 || edgeIntersects) {
      overlappingIds.push(farm.id);
      const ratio = Math.max(
        pointsInside / newPoly.length,
        existingInside / farm.coordinates.length,
        edgeIntersects ? 0.35 : 0.1
      );
      const pct = Math.round(ratio * 100);
      if (pct > maxPercentage) maxPercentage = pct;
    }
  }

  if (overlappingIds.length === 0) {
    return {
      hasOverlap: false,
      overlapType: "NONE",
      overlappingFarmIds: [],
      maxOverlapPercentage: 0,
    };
  }

  const overlapType = maxPercentage >= 30 ? "SIGNIFICANT" : "PARTIAL";

  return {
    hasOverlap: true,
    overlapType,
    overlappingFarmIds: overlappingIds,
    maxOverlapPercentage: maxPercentage,
  };
}
