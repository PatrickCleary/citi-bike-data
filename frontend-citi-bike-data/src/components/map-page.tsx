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
  useUpdateInfoModeSelectedCell,
  usePrefetchTripCountData,
  useTripCountData,
} from "@/map/map-config";

import { TotalDisplay } from "./total-display";
import Popup from "@/map/popup";
import { addImages } from "@/map/utils";
import { LayerControl } from "./layer-control";

import { DateControl } from "./date-control";
import { DisplaySettings } from "./display-settings";
import { InteractionModeToggle } from "./interaction-mode-toggle";
import { Legend } from "./legend";
import { useFetchLatestDate } from "@/store/store";
import IconLogo from "@/icons/icon";

export const MapPage: React.FC = () => {
  const map: MutableRefObject<Map | null> = useRef(null);
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const tripCountQuery = useTripCountData();
  useUpdateMapStyleOnDataChange(map, mapLoaded);
  useApplyLayers(map, mapLoaded);
  useFetchLatestDate();
  useUpdateOriginShape(map, mapLoaded);
  useUpdateInfoModeSelectedCell(map, mapLoaded);
  useAddPMTilesProtocol();
  usePrefetchTripCountData();
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
        <div className="md:bg-cb-white/50 fixed left-4 top-4 z-10 flex flex-row items-center overflow-hidden rounded-md drop-shadow-md backdrop-blur-sm">
          <IconLogo className="md:hidden" width={32} />
          <IconLogo className="hidden drop-shadow-md md:flex" width={32} />
          <h1 className="hidden px-2 font-sans text-lg font-light tracking-wide text-[#396c87] md:flex">
            CitiBike Data
          </h1>
        </div>
        <div className="fixed top-4 z-10 flex w-full flex-col items-center gap-4 md:bottom-4 md:left-auto md:right-4 md:top-auto md:w-fit md:items-end">
          <div className="w-fit">
            <TotalDisplay />
          </div>
        </div>
        <div className="pointer-events-none fixed bottom-4 left-4 z-10 flex flex-col gap-2">
          <Legend />

          <LayerControl map={map} mapLoaded={mapLoaded} />
          <DisplaySettings />
          <div className="w-fit md:hidden">
            <InteractionModeToggle />
          </div>
          <DateControl />
        </div>
      </div>
      <Popup map={map} />
    </div>
  );
};
