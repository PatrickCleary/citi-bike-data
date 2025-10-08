import { BOTTOM_LEFT, TOP_RIGHT } from "@/components/constants";

interface StadiaGeocodingResult {
  features: Array<{
    properties: {
      name: string;
      label: string;
    };
    geometry: {
      coordinates: [number, number];
    };
  }>;
}

export interface LocationResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
}

export async function searchLocation(query: string): Promise<LocationResult[]> {
  if (!query.trim()) {
    return [];
  }

  const url = `https://api.stadiamaps.com/geocoding/v1/autocomplete?text=${encodeURIComponent(query)}&boundary.rect.min_lon=${BOTTOM_LEFT[0]}&boundary.rect.min_lat=${BOTTOM_LEFT[1]}&boundary.rect.max_lon=${TOP_RIGHT[0]}&boundary.rect.max_lat=${TOP_RIGHT[1]}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.statusText}`);
  }
  console.log(response);
  const data: StadiaGeocodingResult = await response.json();

  return data.features.map((feature) => ({
    name: feature.properties.name,
    label: feature.properties.label,
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
  }));
}
