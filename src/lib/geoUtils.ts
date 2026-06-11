/**
 * Calculates the distance between two points in km using the Haversine formula.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Finds the closest location from a list within a specific radius (in km).
 */
export function findClosestLocation(
  lat: number,
  lng: number,
  locations: any[],
  radiusKm: number = 2
): any | null {
  if (!locations.length) return null;

  let closest = null;
  let minDistance = radiusKm;

  for (const loc of locations) {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') continue;
    
    const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = loc;
    }
  }

  return closest;
}
