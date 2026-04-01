/**
 * Converts numeric degrees to radians.
 * @param degrees - The degrees to convert
 * @returns radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the distance between two geographic coordinates using the Haversine formula.
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
}

/**
 * Filters a list of locations by distance from a reference point.
 * @param locations Array of objects with `latitude` and `longitude` properties
 * @param refLat Reference latitude
 * @param refLon Reference longitude
 * @param maxDistanceKm Maximum distance in kilometers
 * @returns Filtered array of locations within maxDistanceKm
 */
export function filterLocationsByRadius<T extends { latitude: number; longitude: number }>(
  locations: T[],
  refLat: number,
  refLon: number,
  maxDistanceKm: number,
): T[] {
  return locations.filter((loc) => {
    const distance = haversineDistance(refLat, refLon, loc.latitude, loc.longitude);
    return distance <= maxDistanceKm;
  });
}

/**
 * Finds the nearest location from a list of coordinates to a reference point.
 * @param locations Array of objects with `latitude` and `longitude`
 * @param refLat Reference latitude
 * @param refLon Reference longitude
 * @returns The nearest location or null if array is empty
 */
export function findNearestLocation<T extends { latitude: number; longitude: number }>(
  locations: T[],
  refLat: number,
  refLon: number,
): T | null {
  if (locations.length === 0) return null;

  let nearest = locations[0];
  let minDistance = haversineDistance(refLat, refLon, nearest.latitude, nearest.longitude);

  for (const loc of locations.slice(1)) {
    const distance = haversineDistance(refLat, refLon, loc.latitude, loc.longitude);
    if (distance < minDistance) {
      nearest = loc;
      minDistance = distance;
    }
  }

  return nearest;
}
