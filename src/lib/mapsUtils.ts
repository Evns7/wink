/**
 * Google Maps URL generation utilities
 * Generates working Google Maps URLs for coordinates and searches
 */

/**
 * Generates a direct location pin URL
 * @param lat - Latitude
 * @param lng - Longitude
 * @param zoom - Zoom level (default: 15)
 * @returns Google Maps URL with pin at exact coordinates
 */
export const generateMapsPinUrl = (lat: number, lng: number, zoom: number = 15): string => {
  return `https://www.google.com/maps/@${lat},${lng},${zoom}z`;
};

/**
 * Generates a search URL for places near coordinates
 * @param searchTerm - What to search for (e.g., "restaurants", "parks")
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Google Maps search URL for places near the coordinates
 */
export const generateMapsSearchUrl = (searchTerm: string, lat: number, lng: number): string => {
  const encodedSearch = encodeURIComponent(searchTerm);
  return `https://www.google.com/maps/search/?api=1&query=${encodedSearch}+near+${lat},${lng}`;
};

/**
 * Generates a directions URL from one location to another
 * @param fromLat - Starting latitude
 * @param fromLng - Starting longitude
 * @param toLat - Destination latitude
 * @param toLng - Destination longitude
 * @returns Google Maps directions URL
 */
export const generateMapsDirectionsUrl = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): string => {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}`;
};

/**
 * Generates a place details URL using place name and coordinates
 * @param placeName - Name of the place
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Google Maps URL showing the specific place
 */
export const generateMapsPlaceUrl = (placeName: string, lat: number, lng: number): string => {
  const encodedName = encodeURIComponent(placeName);
  return `https://www.google.com/maps/search/?api=1&query=${encodedName}&query_place_id=${lat},${lng}`;
};
