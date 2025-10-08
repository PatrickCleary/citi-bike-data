import { useLocationSearchStore } from "@/store/location-search-store";
import { Map } from "maplibre-gl";
import { MutableRefObject, useEffect } from "react";

const MARKER_SOURCE_ID = "location-marker";
const MARKER_LAYER_ID = "location-marker-layer";

export const useLocationMarker = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const selectedLocation = useLocationSearchStore(
    (state) => state.selectedLocation,
  );

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const mapInstance = map.current;

    // Add source and layer if they don't exist
    if (!mapInstance.getSource(MARKER_SOURCE_ID)) {
      mapInstance.addSource(MARKER_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      mapInstance.addLayer({
        id: MARKER_LAYER_ID,
        type: "circle",
        source: MARKER_SOURCE_ID,
        paint: {
          "circle-radius": 4,
          "circle-color": "#111827",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    // Update marker location
    if (selectedLocation) {
      const source = mapInstance.getSource(
        MARKER_SOURCE_ID,
      ) as maplibregl.GeoJSONSource;
      if (source && source.type === "geojson") {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [selectedLocation.lon, selectedLocation.lat],
              },
              properties: {},
            },
          ],
        });
      }

      // Zoom to location
      mapInstance.flyTo({
        center: [selectedLocation.lon, selectedLocation.lat],
        zoom: 14,
        duration: 1500,
      });
    } else {
      // Clear marker
      const source = mapInstance.getSource(
        MARKER_SOURCE_ID,
      ) as maplibregl.GeoJSONSource;
      if (source && source.type === "geojson") {
        source.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
    }
  }, [map, mapLoaded, selectedLocation]);
};
