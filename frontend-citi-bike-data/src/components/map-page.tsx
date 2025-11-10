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
  useUpdateMapBounds,
} from "@/map/map-config";
import { useLocationMarker } from "@/map/use-location-marker";

import Popup from "@/map/popup";
import { addImages } from "@/map/utils";
import { LayerControl } from "./layer-control";

import { DateControl } from "./date-control";
import { DisplaySettings } from "./display-settings";
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
import { ShareButton } from "./share-button";
import { useUrlConfig } from "@/hooks/use-url-config";

export const MapPage: React.FC = () => {
  const map: MutableRefObject<Map | null> = useRef(null);
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const hasConfig = useUrlConfig();
  useUpdateMapStyleOnDataChange(map, mapLoaded, hasConfig);
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
  useUpdateMapBounds(map, mapLoaded);
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
    <div className="flex h-[100svh] w-[100svw] flex-col font-sans">
      <div className="h-full w-full" ref={mapContainer}>
        <Logo />
        <ZoomLevelOverlay map={map} mapLoaded={mapLoaded} />
        <div className="pointer-events-none absolute bottom-2 z-10 flex w-full flex-col gap-2">
          <div className="flex flex-col gap-1 px-4">
            <Legend />
            <LayerControl map={map} mapLoaded={mapLoaded} />
            <DisplaySettings />
            <LocationSearchControl />
            <div className="pointer-events-auto flex flex-row w-full justify-between md:justify-start md:gap-2">
              <DateControl />
              <ShareButton />
            </div>
          </div>
        </div>
      </div>
      <MobileMetricsContainer />
      <DesktopMetricsContainer />

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
      className="fixed left-4 top-4 z-10 flex flex-row items-center overflow-hidden rounded-md drop-shadow-md backdrop-blur-sm transition hover:bg-white active:scale-95 md:bg-cb-white"
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
