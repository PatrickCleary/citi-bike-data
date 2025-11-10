import { cellToBoundary } from "h3-js";
import { LngLatBoundsLike } from "maplibre-gl";

/**
 * Calculate a bounding box that encompasses all provided H3 cells
 * @param cells - Array of H3 cell IDs
 * @returns LngLatBoundsLike [minLng, minLat, maxLng, maxLat] or null if no cells
 */
export function calculateCellsBounds(cells: string[]): LngLatBoundsLike | null {
  if (cells.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  // Get boundaries for each cell and expand the bounding box
  for (const cell of cells) {
    try {
      // cellToBoundary returns array of [lat, lng] pairs
      const boundary = cellToBoundary(cell);

      for (const [lat, lng] of boundary) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    } catch (error) {
      console.warn(`Failed to get boundary for cell ${cell}:`, error);
    }
  }

  // Return null if no valid cells were processed
  if (!isFinite(minLng)) return null;

  // Add a small padding (about 5% on each side)
  const lngPadding = (maxLng - minLng) * 0.15;
  const latPadding = (maxLat - minLat) * 0.15;

  return [
    minLng - lngPadding,
    minLat - latPadding,
    maxLng + lngPadding,
    maxLat + latPadding,
  ] as LngLatBoundsLike;
}
