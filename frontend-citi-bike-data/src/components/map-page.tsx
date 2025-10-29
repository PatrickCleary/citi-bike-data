"use client";
import type { MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Map, MapSourceDataEvent } from "maplibre-gl";
import { isMobileDevice } from "@/utils/mobile-detection";
import { DESKTOP_BOUNDS, MAP_CONFIG_DEFAULT, MOBILE_BOUNDS } from "./constants";
import {
  useAddPMTilesProtocol,
  useApplyLayers,
  useUpdateMapStyleOnDataChange,
  useUpdateOriginShape,
  useUpdateDestinationShape,
  useDimNonSelectedCells,
  usePrefetchTripCountData,
  useUpdateBikeLaneFilter,
} from "@/map/map-config";
import { useLocationMarker } from "@/map/use-location-marker";

import { MetricsContainer } from "./metrics/metrics-container";
import Popup from "@/map/popup";
import { addImages } from "@/map/utils";
import { LayerControl } from "./layer-control";

import { DateControl } from "./date-control";
import { DisplaySettings } from "./display-settings";
import { SelectionModeToggle } from "./selection-mode-toggle";
import { Legend } from "./legend";
import { useFetchLatestDate, useSync } from "@/store/store";
import IconLogo from "@/icons/icon";
import { LocationSearchModal } from "./location-search-modal";
import { LocationSearchControl } from "./location-search-control";
import { IntroModal } from "./intro-modal";
import { useIntroModalStore } from "@/store/intro-modal-store";
import { ZoomLevelOverlay } from "./zoom-level-overlay";
import { MobileMetricsContainer } from "./metrics/mobile-metrics-container";
import { DesktopMetricsContainer } from "./metrics/desktop-metrics-container";

export const MapPage: React.FC = () => {
  const map: MutableRefObject<Map | null> = useRef(null);
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useUpdateMapStyleOnDataChange(map, mapLoaded);
  useApplyLayers(map, mapLoaded);
  useFetchLatestDate();
  useUpdateOriginShape(map, mapLoaded);
  useUpdateDestinationShape(map, mapLoaded);
  useDimNonSelectedCells(map, mapLoaded);
  useSync();

  useAddPMTilesProtocol();
  usePrefetchTripCountData();
  useLocationMarker(map, mapLoaded);
  useUpdateBikeLaneFilter(map, mapLoaded);
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
      bounds: isMobile ? MOBILE_BOUNDS : DESKTOP_BOUNDS,
      container: mapContainer.current,
    });
    map.current?.on("load", async () => {
      await addImages(map);

      map.current?.addControl(new maplibregl.AttributionControl(), "top-right");
      setMapLoaded(true);
    });
  }, [isMobile]);

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
        <Logo />
        <ZoomLevelOverlay map={map} mapLoaded={mapLoaded} />
        {/* <div className="pointer-events-none fixed top-4 z-10 flex hidden w-full flex-col items-center gap-4 px-16 md:left-1/2 md:top-4 md:flex md:-translate-x-1/2 md:flex-row md:justify-center">
          <MetricsContainer />
        </div> */}
        <div className="pointer-events-none fixed bottom-0 z-10 w-full gap-2 flex flex-col">
          <div className="px-4 flex flex-col gap-1">
            <Legend />
            <LayerControl map={map} mapLoaded={mapLoaded} />
            <DisplaySettings />
            <SelectionModeToggle />
            <LocationSearchControl />
            <div className="pointer-events-auto flex flex-row gap-2">
              <DateControl />
            </div>
          </div>
          <MobileMetricsContainer />
          <DesktopMetricsContainer />
        </div>
      </div>

      <Popup map={map} />
      <LocationSearchModal />
      <IntroModal />
    </div>
  );
};

export const Logo: React.FC = () => {
  const { setIsOpen } = useIntroModalStore();

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed left-4 top-4 z-10 flex flex-row items-center overflow-hidden rounded-md drop-shadow-md backdrop-blur-sm transition hover:bg-cb-white/70 active:scale-95 md:bg-cb-white/50"
      aria-label="Open introduction modal"
    >
      <IconLogo className="md:hidden" width={32} />
      <IconLogo className="hidden drop-shadow-md md:flex" width={32} />
      <h1 className="hidden px-2 font-sans text-lg font-light tracking-wide text-cb-blue md:flex">
        Citi Bike Data
      </h1>
    </button>
  );
};
