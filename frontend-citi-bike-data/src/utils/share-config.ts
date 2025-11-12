import { LngLatBoundsLike } from "maplibre-gl";

/**
 * Configuration interface representing all shareable app state
 */
export interface ShareableConfig {
  // Date selection
  selectedMonth?: string;

  // Cell selection
  originCells: string[];
  destinationCells: string[];

  // Display settings
  displayType: "absolute" | "comparison";
  normalizeComparison?: boolean;
  scale?: [number, number];
  scaleType?: "dynamic" | "custom";

  // Layer visibility (array of visible layer group IDs)
  visibleLayers: string[];

  // Map bounds to fit selected cells
  bounds?: LngLatBoundsLike | null;
}

/**
 * Serialize configuration to URL-safe base64 string
 */
export function serializeConfig(config: ShareableConfig): string {
  const json = JSON.stringify(config);
  // Use URL-safe base64 encoding
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Deserialize base64 string back to configuration object
 */
export function deserializeConfig(encoded: string): ShareableConfig | null {
  try {
    // Restore standard base64 format
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as ShareableConfig;
  } catch (error) {
    console.error("Failed to deserialize config:", error);
    return null;
  }
}

/**
 * Create a shareable URL with the current configuration
 */
export function createShareableUrl(config: ShareableConfig): string {
  const encoded = serializeConfig(config);
  const url = new URL(window.location.href);
  url.searchParams.set("config", encoded);
  return url.toString();
}

/**
 * Read configuration from URL parameters
 */
export function readConfigFromUrl(): ShareableConfig | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("config");

  if (!encoded) return null;

  return deserializeConfig(encoded);
}

/**
 * Update browser URL with configuration (without reload)
 */
export function updateUrlWithConfig(config: ShareableConfig): void {
  const url = createShareableUrl(config);
  window.history.replaceState({}, "", url);
}
