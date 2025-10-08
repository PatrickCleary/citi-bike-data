import type { LngLatLike, MapOptions } from "maplibre-gl";

export const BOTTOM_LEFT: LngLatLike = [-74.0848, 40.6304];
export const TOP_RIGHT: LngLatLike = [-73.7877, 40.8916];
export const MAX_BOUNDS: [LngLatLike, LngLatLike] = [
  [-75, 40], // Southwest corner
  [-72, 42], // Northeast corner
];

export const MAP_CONFIG_DEFAULT: Partial<MapOptions> = {
  bounds: [BOTTOM_LEFT, TOP_RIGHT],
  maxBounds: MAX_BOUNDS,
  maxZoom: 16,
  zoom: 12,
  style: "/map_styles/alidade_smooth_custom.json",
  attributionControl: false,
};

export const API_URL = "https://kevndteqglsoslznrntz.supabase.co";

export const TEXT_1 = "text-xs uppercase tracking-wider";
export const TEXT_2 = "text-xs uppercase tracking-wide";
