"use client";
import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import type { Map } from "maplibre-gl";
import { useMapConfigStore } from "@/store/store";

interface ZoomLevelOverlayProps {
  map: MutableRefObject<Map | null>;
  mapLoaded: boolean;
}

export const ZoomLevelOverlay: React.FC<ZoomLevelOverlayProps> = ({
  map,
  mapLoaded,
}) => {
  const [zoom, setZoom] = useState<number>(0);
  const { originCells, destinationCells } = useMapConfigStore();
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
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Copied to clipboard:", text);
    });
  };

  return (
    <div className="pointer-events-auto fixed right-4 top-4 z-50 hidden rounded-md bg-black/70 px-3 py-2 font-mono text-sm text-white backdrop-blur-sm md:flex">
      <button
        onClick={() => copyToClipboard(zoom.toFixed(2))}
        className="text-white"
      >
        Zoom: {zoom.toFixed(2)}
      </button>
      <br />
      <button
        onClick={() =>
          copyToClipboard(
            JSON.stringify(
              map.current
                ?.getBounds()
                .toArray()
                .map((num) => num.map((inNum) => inNum.toFixed(5))),
            ),
          )
        }
        className="text-white"
      >
        Bounds (copy){" "}
      </button>
      <br />
      <button
        onClick={() => copyToClipboard(JSON.stringify(originCells))}
        className="text-white"
      >
        Origin (copy)
      </button>
      <br />
      <button
        onClick={() => copyToClipboard(JSON.stringify(destinationCells))}
        className="text-white"
      >
        Destination (copy)
      </button>
    </div>
  );
};
