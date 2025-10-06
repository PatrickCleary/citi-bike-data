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

import { TotalDisplay } from "./total-display";
import Popup from "@/map/popup";
import { addImages } from "@/map/utils";
import { LayerControl } from "./layer-control";
import { MapButton } from "@/map/map-button";
import { DateControl } from "./date-control";
import { DisplaySettings } from "./display-settings";

export const MapPage: React.FC = () => {
  const map: MutableRefObject<Map | null> = useRef(null);
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  useUpdateMapStyleOnDataChange(map, mapLoaded);
  useApplyLayers(map, mapLoaded);
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
    [loading, setLoading],
  );

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new Map({
      ...MAP_CONFIG_DEFAULT,
      container: mapContainer.current,
    });
    map.current?.on("load", async () => {
      await addImages(map);

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
    <div className="flex h-[100svh] w-[100svw] flex-row font-sans">
      <div className="h-full w-full" ref={mapContainer}>
        <div className="fixed top-4 z-10 flex w-full items-center justify-center md:hidden">
          <DateControl />
        </div>
        <div className="fixed bottom-4 right-4 z-10 flex flex-col gap-4">
          <TotalDisplay />

          <div className="hidden md:flex">
            <DateControl />
          </div>
        </div>
        <div className="fixed bottom-4 left-4 z-10 flex flex-col gap-2">
          <LayerControl map={map} mapLoaded={mapLoaded} />
          <DisplaySettings />
          
        </div>
      </div>
      <Popup map={map} />
    </div>
  );
};
