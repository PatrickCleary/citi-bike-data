"use client";
import type { MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Map, MapSourceDataEvent } from "maplibre-gl";
import { MAP_CONFIG_DEFAULT } from "./constants";
import {
  useAddPMTilesProtocol,
  useApplyLayers,
  useUpdateMapStyleOnDataChange,
  useUpdateOriginShape,
} from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import { DateDisplay } from "./date-display";
import { TotalDisplay } from "./total-display";
import Popup from "@/map/popup";
import { addImages } from "@/map/utils";

export const MapPage: React.FC = () => {
  const map: MutableRefObject<Map | null> = useRef(null);
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  useUpdateMapStyleOnDataChange(map, mapLoaded);
  useApplyLayers(map, mapLoaded);
  const { setSelectedMonth, setDepartureCells, analysisType, setAnalysisType } =
    useMapConfigStore();
  useUpdateOriginShape(map, mapLoaded);
  useAddPMTilesProtocol();
  const handleIdle = useCallback(() => {
    if (loading) {
      setLoading(false);
    }
  }, [loading, setLoading]);
  const handleLoading = useCallback(
    (e: MapSourceDataEvent) => {
      // If the tile property is defined, then the event is a tile loading event. Ignore it.
      if (!loading && e.tile === undefined) {
        setLoading(true);
      }
    },
    [loading, setLoading]
  );

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new Map({
      ...MAP_CONFIG_DEFAULT,
      container: mapContainer.current,
    });
    map.current?.on("load", async () => {
      await addImages(map);
      console.log('added')

      // map.current?.removeControl(map.current?.attributionControl);
      map.current?.addControl(new maplibregl.AttributionControl(), "top-right");
      setMapLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.on("idle", handleIdle);
    map.current.on("sourcedataloading", handleLoading);

    return () => {
      map.current?.off("idle", handleIdle);
      map.current?.off("sourcedataloading", handleLoading);
    };
  }, [mapLoaded, handleIdle, handleLoading]);
  return (
    <div className="w-[100svw] h-[100svh] flex flex-row">
      <div className="h-full w-40 bg-white text-black flex flex-col">
        <input
          type="date"
          onInput={(input) => {
            setSelectedMonth(input.target.value);
          }}
        ></input>
        <button onClick={() => setDepartureCells([])}>clear</button>
        <button
          onClick={() =>
            setAnalysisType(
              analysisType === "arrivals" ? "departures" : "arrivals"
            )
          }
        >
          {analysisType}
        </button>
      </div>
      <div className="h-full w-full" ref={mapContainer}>
        <div className="fixed flex flex-col gap-4 z-10 right-4 bottom-4">
          <TotalDisplay />
          <DateDisplay />
        </div>
      </div>
      <Popup map={map} />
    </div>
  );
};
