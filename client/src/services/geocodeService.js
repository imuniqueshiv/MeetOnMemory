/**
 * Geocoding and map URL service for physical and virtual meeting venues (#2256).
 */

const geocodeCache = new Map();

// Regex pattern to detect online meeting URLs or generic web links
const VIRTUAL_MEETING_REGEX =
  /^(https?:\/\/|(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com|skype\.com))/i;

/**
 * Checks whether a given venue string is a virtual / online meeting link.
 * @param {string} venue
 * @returns {boolean}
 */
export const isVirtualMeetingUrl = (venue) => {
  if (!venue || typeof venue !== "string") return false;
  const trimmed = venue.trim();
  return (
    VIRTUAL_MEETING_REGEX.test(trimmed) ||
    trimmed.includes("zoom.us/") ||
    trimmed.includes("meet.google.com/") ||
    trimmed.includes("teams.microsoft.com/") ||
    trimmed.includes("webex.com/")
  );
};

/**
 * Attempts to geocode a physical venue address to lat/lng coordinates using OpenStreetMap Nominatim.
 * Returns cached results when available, and respects virtual meeting links.
 *
 * @param {string} query - The venue address or location string
 * @param {object} [options]
 * @param {number} [options.timeout=5000] - Request timeout in milliseconds
 * @returns {Promise<{lat: number, lng: number, displayName?: string, isVirtual?: boolean, url?: string} | null>}
 */
export const geocodeVenue = async (query, { timeout = 5000 } = {}) => {
  if (!query || typeof query !== "string") return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (isVirtualMeetingUrl(trimmed)) {
    const formattedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return {
      isVirtual: true,
      url: formattedUrl,
      lat: null,
      lng: null,
    };
  }

  const cacheKey = trimmed.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed,
    )}&limit=1`;

    const response = await fetch(endpoint, {
      signal: controller ? controller.signal : undefined,
      headers: {
        Accept: "application/json",
      },
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
        isVirtual: false,
      };
      geocodeCache.set(cacheKey, result);
      return result;
    }

    geocodeCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.warn("Geocoding service error:", err.message);
    return null;
  }
};

/**
 * Generates an OpenStreetMap embed iframe URL.
 *
 * @param {{lat: number, lng: number}} coordinates
 * @param {number} [delta=0.006] - Bounding box radius delta
 * @returns {string|null}
 */
export const getMapEmbedUrl = (coordinates, delta = 0.006) => {
  if (
    !coordinates ||
    typeof coordinates.lat !== "number" ||
    typeof coordinates.lng !== "number" ||
    Number.isNaN(coordinates.lat) ||
    Number.isNaN(coordinates.lng)
  ) {
    return null;
  }

  const { lat, lng } = coordinates;
  const left = (lng - delta).toFixed(6);
  const bottom = (lat - delta).toFixed(6);
  const right = (lng + delta).toFixed(6);
  const top = (lat + delta).toFixed(6);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat.toFixed(
    6,
  )}%2C${lng.toFixed(6)}`;
};

/**
 * Returns external Google Maps link.
 *
 * @param {string} venue
 * @param {{lat?: number, lng?: number}} [coordinates]
 * @returns {string}
 */
export const getGoogleMapsUrl = (venue, coordinates) => {
  if (
    coordinates &&
    typeof coordinates.lat === "number" &&
    typeof coordinates.lng === "number"
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venue || "",
  )}`;
};

/**
 * Returns external OpenStreetMap link.
 *
 * @param {string} venue
 * @param {{lat?: number, lng?: number}} [coordinates]
 * @returns {string}
 */
export const getOpenStreetMapUrl = (venue, coordinates) => {
  if (
    coordinates &&
    typeof coordinates.lat === "number" &&
    typeof coordinates.lng === "number"
  ) {
    return `https://www.openstreetmap.org/?mlat=${coordinates.lat}&mlon=${coordinates.lng}#map=16/${coordinates.lat}/${coordinates.lng}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(
    venue || "",
  )}`;
};
