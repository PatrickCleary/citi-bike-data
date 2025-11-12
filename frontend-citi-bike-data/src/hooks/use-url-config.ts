import { useEffect, useRef, useState } from "react";
import { useFetchLatestDate, useMapConfigStore } from "@/store/store";
import { useLayerVisibilityStore } from "@/store/layer-visibility-store";
import { readConfigFromUrl, type ShareableConfig } from "@/utils/share-config";
import { LngLatBoundsLike } from "maplibre-gl";

/**
 * Hook that reads configuration from URL on mount and applies it to stores
 * This should be called once at the app root level
 */
export const useUrlConfig = () => {
  const hasInitialized = useRef(false);
  const [hasConfig, setHasConfig] = useState<boolean | undefined>(undefined);
  const [hasConfigDate, setHasConfigDate] = useState<boolean | undefined>(
    undefined,
  );

  const {
    setSelectedMonth,
    setOriginCells,
    setDestinationCells,
    setDisplayType,
    setNormalizeComparison,
    setScale,
    setScaleType,
    setTargetBounds,
  } = useMapConfigStore();

  const { setLayerGroupVisibility, layerGroups } = useLayerVisibilityStore();

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const config = readConfigFromUrl();
    if (!config) {
      setHasConfig(false);
      setHasConfigDate(false);
      return;
    }
    if (config.selectedMonth) {
      setHasConfigDate(true);
    } else {
      setHasConfigDate(false);
    }
    setHasConfig(true);
    // Apply configuration to stores
    applyConfig(config, {
      setSelectedMonth,
      setOriginCells,
      setDestinationCells,
      setDisplayType,
      setNormalizeComparison,
      setScale,
      setScaleType,
      setTargetBounds,
      setLayerGroupVisibility,
      layerGroups,
    });

    // Remove config parameter from URL after loading
    const url = new URL(window.location.href);
    url.searchParams.delete("config");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount
  return { hasConfig, hasConfigDate };
};

interface StoreActions {
  setSelectedMonth: (month: string | undefined) => void;
  setOriginCells: (cells: string[]) => void;
  setDestinationCells: (cells: string[]) => void;
  setDisplayType: (type: "absolute" | "comparison") => void;
  setNormalizeComparison: (normalize: boolean) => void;
  setScale: (scale: [number, number]) => void;
  setScaleType: (type: "dynamic" | "custom") => void;
  setTargetBounds: (bounds: LngLatBoundsLike | null) => void;
  setLayerGroupVisibility: (groupId: string, visible: boolean) => void;
  layerGroups: Array<{ id: string; visible: boolean }>;
}

function applyConfig(config: ShareableConfig, actions: StoreActions) {
  // Apply date
  actions.setSelectedMonth(config.selectedMonth);
  // Apply cell selections
  if (config.originCells.length > 0) {
    actions.setOriginCells(config.originCells);
  }
  if (config.destinationCells.length > 0) {
    actions.setDestinationCells(config.destinationCells);
  }

  // Apply display settings
  actions.setDisplayType(config.displayType);

  if (config.normalizeComparison !== undefined) {
    actions.setNormalizeComparison(config.normalizeComparison);
  }

  if (config.scale && config.scaleType) {
    actions.setScaleType(config.scaleType);
    if (config.scaleType === "custom") {
      actions.setScale(config.scale);
    }
  }

  // Apply layer visibility
  // First, hide all layers not in the config
  actions.layerGroups.forEach((group) => {
    const shouldBeVisible = config.visibleLayers.includes(group.id);
    if (group.visible !== shouldBeVisible) {
      actions.setLayerGroupVisibility(group.id, shouldBeVisible);
    }
  });

  // Apply bounds to move map to fit selected cells
  if (config.bounds) {
    actions.setTargetBounds(config.bounds);
  }
}

export const useInitializeConfig = () => {
  const { hasConfig, hasConfigDate } = useUrlConfig();
  useFetchLatestDate(hasConfigDate);
  return hasConfig;
};
