/**
 * Location service utilities for geographic calculations
 */

/**
 * Calculates the geographic midpoint between two coordinates using the Haversine formula
 * @param lat1 - First location latitude
 * @param lng1 - First location longitude
 * @param lat2 - Second location latitude
 * @param lng2 - Second location longitude
 * @returns Midpoint coordinates { lat, lng }
 */
export const calculateMidpoint = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { lat: number; lng: number } => {
  // Convert to radians
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const lng1Rad = (lng1 * Math.PI) / 180;
  const lng2Rad = (lng2 * Math.PI) / 180;

  // Calculate midpoint using spherical geometry
  const dLng = lng2Rad - lng1Rad;

  const bx = Math.cos(lat2Rad) * Math.cos(dLng);
  const by = Math.cos(lat2Rad) * Math.sin(dLng);

  const lat3Rad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
  );

  const lng3Rad = lng1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);

  // Convert back to degrees
  const lat = (lat3Rad * 180) / Math.PI;
  const lng = (lng3Rad * 180) / Math.PI;

  return { lat, lng };
};

/**
 * Calculates the distance between two coordinates in kilometers
 * @param lat1 - First location latitude
 * @param lng1 - First location longitude
 * @param lat2 - Second location latitude
 * @param lng2 - Second location longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};
