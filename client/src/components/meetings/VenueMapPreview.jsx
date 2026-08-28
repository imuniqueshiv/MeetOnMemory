import React, { useState, useEffect } from "react";
import {
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Video,
  Navigation,
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  geocodeVenue,
  getMapEmbedUrl,
  getGoogleMapsUrl,
  getOpenStreetMapUrl,
  isVirtualMeetingUrl,
} from "../../services/geocodeService";

const VenueMapPreview = ({
  venue = "",
  coordinates = null,
  onCoordinatesResolved = null,
  interactive = true,
  compact = false,
  className = "",
}) => {
  const [resolvedCoords, setResolvedCoords] = useState(
    coordinates && typeof coordinates.lat === "number" ? coordinates : null,
  );
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualUrl, setVirtualUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (coordinates && typeof coordinates.lat === "number") {
      setResolvedCoords(coordinates);
      setIsVirtual(false);
      return;
    }

    if (!venue || !venue.trim()) {
      setResolvedCoords(null);
      setIsVirtual(false);
      setLoading(false);
      return;
    }

    const trimmed = venue.trim();

    if (isVirtualMeetingUrl(trimmed)) {
      setIsVirtual(true);
      const url = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      setVirtualUrl(url);
      setResolvedCoords(null);
      setLoading(false);
      return;
    }

    setIsVirtual(false);
    let isMounted = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await geocodeVenue(trimmed);
        if (!isMounted) return;

        if (result && result.lat && result.lng) {
          setResolvedCoords({ lat: result.lat, lng: result.lng });
          if (onCoordinatesResolved) {
            onCoordinatesResolved({ lat: result.lat, lng: result.lng });
          }
        } else {
          setResolvedCoords(null);
        }
      } catch {
        if (!isMounted) return;
        setResolvedCoords(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [venue, coordinates, onCoordinatesResolved]);

  if (!venue && !resolvedCoords) {
    return null;
  }

  const handleCopy = () => {
    if (!venue) return;
    navigator.clipboard.writeText(venue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const googleMapsUrl = getGoogleMapsUrl(venue, resolvedCoords);
  const osmUrl = getOpenStreetMapUrl(venue, resolvedCoords);
  const embedUrl = resolvedCoords ? getMapEmbedUrl(resolvedCoords) : null;

  // Render Virtual Meeting Link view
  if (isVirtual) {
    return (
      <div
        className={`bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 text-gray-800 dark:text-gray-200 ${className}`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">
                Online / Virtual Venue
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                {venue}
              </p>
            </div>
          </div>
          {virtualUrl && (
            <a
              href={virtualUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
            >
              <span>Join Meeting</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm transition-all ${className}`}
      data-testid="venue-map-preview"
    >
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <MapPin className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm font-semibold truncate max-w-xs sm:max-w-md">
            {venue || "Meeting Location"}
          </span>
        </div>

        {interactive && venue && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy Address"
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
              aria-label="Copy venue address"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Maps"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </a>
            <a
              href={osmUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in OpenStreetMap"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>OSM</span>
            </a>
          </div>
        )}
      </div>

      {/* Map Embed or Loading / Fallback */}
      <div className="relative bg-gray-50 dark:bg-gray-900">
        {loading ? (
          <div
            className={`flex flex-col items-center justify-center gap-2 ${
              compact ? "h-36" : "h-48"
            } text-gray-500 dark:text-gray-400`}
            role="status"
          >
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs">Locating venue on map...</span>
          </div>
        ) : embedUrl ? (
          <iframe
            title={`Venue map preview for ${venue || "location"}`}
            src={embedUrl}
            className={`w-full ${compact ? "h-40" : "h-52"} border-0`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div
            className={`flex flex-col items-center justify-center p-6 text-center ${
              compact ? "h-36" : "h-44"
            } bg-gray-50 dark:bg-gray-800/60`}
          >
            <AlertCircle className="w-6 h-6 text-amber-500 mb-1.5" />
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Interactive map preview unavailable for this location
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3 max-w-sm">
              You can still search or open this address in external maps.
            </p>
            {venue && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition"
              >
                <span>Search location on Google Maps</span>
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueMapPreview;
