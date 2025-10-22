"use client";
import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import type { Map } from "maplibre-gl";

interface ZoomLevelOverlayProps {
  map: MutableRefObject<Map | null>;
  mapLoaded: boolean;
}

export const ZoomLevelOverlay: React.FC<ZoomLevelOverlayProps> = ({
  map,
  mapLoaded,
}) => {
  const [zoom, setZoom] = useState<number>(0);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const updateZoom = () => {
      setZoom(map.current?.getZoom() ?? 0);
    };

    // Set initial zoom
    updateZoom();

    // Listen for zoom changes
    map.current.on("zoom", updateZoom);

    return () => {
      map.current?.off("zoom", updateZoom);
    };
  }, [map, mapLoaded]);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-md bg-black/70 px-3 py-2 font-mono text-sm text-white backdrop-blur-sm">
      Zoom: {zoom.toFixed(2)}
    </div>
  );
};
