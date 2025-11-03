"use client";
import { MutableRefObject, useEffect, useRef } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { createPortal } from "react-dom";
import maplibregl, { Map, Popup } from "maplibre-gl";
import { ClickedFeature, usePopupStateStore } from "@/store/popup-store";
import {
  useTripCountData,
  useComparison,
  useComparisonData,
} from "./map-config";
import { formatter } from "@/utils/utils";
import { useMapConfigStore } from "@/store/store";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import PedalBikeRoundedIcon from "@mui/icons-material/PedalBikeRounded";
import HexagonIcon from "@mui/icons-material/Hexagon";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";

import dayjs from "dayjs";
import classNames from "classnames";
import AddHexIcon from "@/icons/add-hex";
import MinusHexIcon from "@/icons/minus-hex";
interface PopupProps {
  map: MutableRefObject<Map | null>;
}

export const PopupComponent: React.FC<PopupProps> = ({ map }) => {
  // a ref to hold the popup instance
  const popupRef = useRef<Popup>();
  // a ref for an element to hold the popup's content
  const contentRef = useRef<HTMLDivElement | null>(null);
  const query = useTripCountData();
  const previousQuery = useComparisonData();
  const tripCounts = query.data?.data.trip_counts || {};
  const previousTripCounts = previousQuery.data?.data.trip_counts || {};
  const { hoveredFeature, clickedFeature } = usePopupStateStore();

  const { displayType, scale, selectedMonth } = useMapConfigStore();
  const comparison = useComparison(false);
  const loading = query.isLoading;

  // Use clicked feature if it exists, otherwise use hovered feature
  const activeFeature = clickedFeature || hoveredFeature;
  const isClicked = !!clickedFeature;

  const hoveredTripCount = tripCounts[activeFeature?.id as string] || undefined;
  const hoveredPreviousTripCount =
    previousTripCounts[activeFeature?.id as string] || undefined;
  const cellComparison = activeFeature?.id
    ? comparison.getCellComparison(activeFeature.id as string)
    : null;

  // Get hex color based on display type
  const hexColor =
    displayType === "absolute"
      ? getHexagonColorByAbsoluteValue(hoveredTripCount, scale)
      : getHexagonColorBySignificance(cellComparison?.significance);

  // Initialize contentRef with a div element on mount
  useEffect(() => {
    if (!contentRef.current) {
      contentRef.current = document.createElement("div");
    }
  }, []);

  // instantiate the popup on mount, remove it on unmount
  useEffect(() => {
    if (!map.current) return;

    // create a new popup instance, but do not set its location or content yet
    popupRef.current = new maplibregl.Popup({
      closeOnClick: false,
      // offset: 10,
      // anchor: "top",
      closeButton: false,
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
    };
  }, [map.current]);

  // Add click listener to clear clicked feature when clicking outside
  const { setClickedFeature } = usePopupStateStore();
  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.current?.queryRenderedFeatures(e.point);
      const hasHexFeature = features?.some(
        (f) => f.layer.id === "nyc_jc_hex_tiles_layer",
      );

      if (!hasHexFeature && clickedFeature) {
        setClickedFeature(null);
      }
    };

    map.current.on("click", handleMapClick);

    return () => {
      map.current?.off("click", handleMapClick);
    };
  }, [map, clickedFeature, setClickedFeature]);

  // when activeFeature changes, set the popup's location and content, and add it to the map
  useEffect(() => {
    if (!popupRef.current || !map.current) return;

    if (!activeFeature) {
      popupRef.current.remove();
      return;
    }

    // Only require data for hover (not for clicked cells)
    if (
      !isClicked &&
      hoveredTripCount === undefined &&
      hoveredPreviousTripCount === undefined
    ) {
      popupRef.current.remove();
      return;
    }
    if (!contentRef.current) return;
    popupRef.current
      .setLngLat(activeFeature.coordinates) // set its position using activeFeature's geometry
      .setDOMContent(contentRef.current) // use contentRef to set the DOM content of the popup
      .addTo(map.current); // add the popup to the map
  }, [activeFeature, hoveredTripCount, hoveredPreviousTripCount, isClicked]);
  // use a react portal to render the content to show in the popup, assigning it to contentRef
  return (
    <>
      {contentRef.current &&
        createPortal(
          <PopupContent
            hoveredTripCount={hoveredTripCount}
            loading={loading}
            hexColor={hexColor}
            cellId={activeFeature?.id as string}
            comparison={comparison}
            selectedMonth={selectedMonth}
            showButtons={isClicked}
          />,
          contentRef.current,
        )}
    </>
  );
};

export default PopupComponent;

export const PopupContent: React.FC<{
  loading: boolean;
  hoveredTripCount: number | undefined;
  hexColor: string;
  cellId: string;
  comparison: ReturnType<typeof useComparison>;
  selectedMonth: string | undefined;
  showButtons: boolean;
}> = ({
  loading,
  hoveredTripCount,
  hexColor,
  cellId,
  comparison,
  selectedMonth,
  showButtons,
}) => {
  const {
    analysisType,
    originCells,
    displayType,
    destinationCells,
    comparisonDelta,
    addOrRemoveOriginCell,
    addOrRemoveDestinationCell,
  } = useMapConfigStore();
  const { setClickedFeature, clickedFeature } = usePopupStateStore();
  const noCellsSelected =
    originCells.length === 0 && destinationCells.length === 0;
  const isSelected = clickedFeature?.isDestination || clickedFeature?.isOrigin;

  const handleAddOrigin = () => [
    addOrRemoveOriginCell(cellId),
    setClickedFeature(null),
  ];
  const handleAddDestination = () => [
    addOrRemoveDestinationCell(cellId),
    setClickedFeature(null),
  ];

  const showTripCountMetric = () => {
    if (clickedFeature?.isOrigin) return false;
    if (clickedFeature?.isDestination && originCells.length === 0) return false;
    return true;
  };

  const cellComparison = cellId ? comparison.getCellComparison(cellId) : null;
  const isPositiveChange = cellComparison
    ? cellComparison.absoluteChange > 0
    : false;

  // Calculate previous year's month for the "no data" message
  const comparisonDate = selectedMonth
    ? dayjs(selectedMonth).add(comparisonDelta)
    : null;

  if (noCellsSelected)
    return (
      <PopupDiv>
        {showButtons && <CloseButton onClick={() => setClickedFeature(null)} />}

        <div className="flex flex-row items-center justify-center gap-2 font-sans">
          <ArrDepIcon analysisType={analysisType} />
          <TripCountPopupMetric
            tripCount={hoveredTripCount}
            loading={loading}
          />
        </div>
        <p className="flex flex-row items-center gap-1 text-center text-xs font-light uppercase tracking-wide">
          {analysisType === "arrivals" ? "arrived here" : "began from"}
          <HexagonIcon
            fontSize="small"
            style={{
              color: hexColor,
            }}
            className="drop-shadow-cb-hex"
          />
        </p>
        {displayType === "comparison" && (
          <ComparisonPopupMetric
            cellId={cellId}
            comparisonDate={comparisonDate}
          />
        )}
        {showButtons && (
          <SelectionButtons cellId={cellId} clickedFeature={clickedFeature} />
        )}
      </PopupDiv>
    );

  return (
    <PopupDiv>
      {showButtons && <CloseButton onClick={() => setClickedFeature(null)} />}
      {showTripCountMetric() && (
        <>
          <div className="flex flex-row items-center justify-center gap-2 font-sans">
            <ArrDepIcon analysisType={analysisType} />
            <TripCountPopupMetric
              tripCount={hoveredTripCount}
              loading={loading}
            />
          </div>
          <ArrDepText analysisType={analysisType} hexColor={hexColor} />
        </>
      )}
      {displayType === "comparison" && (
        <ComparisonPopupMetric
          cellId={cellId}
          comparisonDate={comparisonDate}
        />
      )}
      {showButtons && (
        <SelectionButtons cellId={cellId} clickedFeature={clickedFeature} />
      )}
    </PopupDiv>
  );
};

const PopupDiv: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="rounded-2 flex min-w-[160px] flex-col items-center rounded-md border-[.5px] border-cb-white/50 bg-white/30 px-2 px-4 py-1 py-2 text-center font-sans text-lg tabular-nums text-black text-neutral-800 drop-shadow-md backdrop-blur-md">
      {children}
    </div>
  );
};

export const spanClassName =
  "bg-cb-lightGray/50 flex flex-row items-center rounded-sm px-1 flex flex-row gap-[2px]";
const ArrDepText: React.FC<{
  analysisType: "arrivals" | "departures";
  hexColor: string;
}> = ({ analysisType, hexColor = "#cccccc" }) => {
  if (analysisType === "arrivals") {
    return (
      <p className="text-xs font-light uppercase">
        <span className="flex flex-row items-center gap-1 tracking-wide">
          From
          <HexagonOutlinedIcon
            fontSize="small"
            className="drop-shadow-cb-hex"
          />
          to
          <HexagonIcon
            fontSize="small"
            className="drop-shadow-cb-hex"
            style={{
              color: hexColor,
            }}
          />
        </span>
      </p>
    );
  } else {
    return (
      <p className="text-xs font-light uppercase">
        <span className="flex flex-row items-center gap-1">
          From
          <HexagonIcon
            fontSize="small"
            style={{
              color: hexColor,
            }}
            className="drop-shadow-cb-hex"
          />
          to
          <HexagonOutlinedIcon
            fontSize="small"
            className="drop-shadow-cb-hex"
          />
        </span>
      </p>
    );
  }
};

const ArrDepIcon: React.FC<{ analysisType: "arrivals" | "departures" }> = ({
  analysisType,
}) => {
  if (analysisType === "arrivals") {
    return <span className="material-symbols-outlined">bike_dock</span>;
  }
  return <PedalBikeRoundedIcon />;
};
// Helper function to calculate hexagon color based on absolute value using viridis colormap
const getHexagonColorByAbsoluteValue = (
  value: number | undefined,
  scale: [number, number],
): string => {
  if (value === undefined || value < scale[0]) {
    return "#F2F3F0"; // default color for undefined or below scale minimum
  }

  // Use logarithmic scale like the map does
  const logMin = Math.log(scale[0] + 1);
  const logMax = Math.log(scale[1] + 1);
  const logValue = Math.log(value + 1);

  // Clamp to scale range
  const clampedLogValue = Math.max(logMin, Math.min(logMax, logValue));

  // Normalize to 0-1 range
  const normalized = (clampedLogValue - logMin) / (logMax - logMin);

  // Color stops based on viridis colormap (matching the map)
  const colorStops: Array<{ position: number; color: string }> = [
    { position: 0.0, color: "#440154" }, // 0% - dark purple
    { position: 0.15, color: "#482878" }, // 15% - purple
    { position: 0.3, color: "#3e4989" }, // 30% - blue-purple
    { position: 0.45, color: "#31688e" }, // 45% - blue
    { position: 0.6, color: "#26828e" }, // 60% - teal
    { position: 0.75, color: "#35b779" }, // 75% - green
    { position: 0.9, color: "#6ece58" }, // 90% - light green
    { position: 1.0, color: "#fde725" }, // 100% - yellow
  ];

  // Find the two color stops to interpolate between
  let lowerStop = colorStops[0];
  let upperStop = colorStops[colorStops.length - 1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (
      normalized >= colorStops[i].position &&
      normalized <= colorStops[i + 1].position
    ) {
      lowerStop = colorStops[i];
      upperStop = colorStops[i + 1];
      break;
    }
  }

  // Calculate interpolation factor between the two stops
  const t =
    (normalized - lowerStop.position) /
    (upperStop.position - lowerStop.position);

  return interpolateColor(lowerStop.color, upperStop.color, t);
};

// Helper function to calculate hexagon color based on significance using BrBG colormap
const getHexagonColorBySignificance = (
  significance: number | undefined,
): string => {
  if (significance === undefined) {
    return "#F2F3F0"; // default color for undefined
  }

  // Color stops based on significance value using BrBG (Brown-Blue-Green) colormap
  const colorStops: Array<{ position: number; color: string }> = [
    { position: -20, color: "#543005" }, // Dark brown - large decrease
    { position: -10, color: "#8c510a" }, // Brown
    { position: -5, color: "#bf812d" }, // Light brown
    { position: -2, color: "#dfc27d" }, // Tan
    { position: 0, color: "#d8d8d8" }, // Very light gray (almost white) - no change
    { position: 2, color: "#80cdc1" }, // Light blue-green
    { position: 5, color: "#35978f" }, // Blue-green
    { position: 10, color: "#01665e" }, // Dark blue-green
    { position: 20, color: "#003c30" }, // Very dark blue-green - large increase
  ];

  // Clamp significance to range [-20, 20]
  const clampedSignificance = Math.max(-20, Math.min(20, significance));

  // Find the two color stops to interpolate between
  let lowerStop = colorStops[0];
  let upperStop = colorStops[colorStops.length - 1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (
      clampedSignificance >= colorStops[i].position &&
      clampedSignificance <= colorStops[i + 1].position
    ) {
      lowerStop = colorStops[i];
      upperStop = colorStops[i + 1];
      break;
    }
  }

  // Calculate interpolation factor between the two stops
  const t =
    (clampedSignificance - lowerStop.position) /
    (upperStop.position - lowerStop.position);

  return interpolateColor(lowerStop.color, upperStop.color, t);
};

// Helper function to interpolate between two hex colors
const interpolateColor = (
  color1: string,
  color2: string,
  t: number,
): string => {
  // Parse hex colors
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const RemovalButtons: React.FC<{
  clickedFeature: ClickedFeature;
  cellId: string;
}> = ({ clickedFeature, cellId }) => {
  const {
    addOrRemoveDestinationCell,
    addOrRemoveOriginCell,
    originCells,
    destinationCells,
    setDestinationCells,
    setOriginCells,
  } = useMapConfigStore();
  const { setClickedFeature } = usePopupStateStore();

  const handleRemove = () => {
    if (clickedFeature?.isDestination) addOrRemoveDestinationCell(cellId);
    if (clickedFeature?.isOrigin) addOrRemoveOriginCell(cellId);
    setClickedFeature(null);
  };
  const handleClear = () => {
    if (clickedFeature?.isDestination) setDestinationCells([]);
    if (clickedFeature?.isOrigin) setOriginCells([]);
    setClickedFeature(null);
  };
  const multipleCells =
    (clickedFeature?.isDestination && destinationCells.length > 1) ||
    (clickedFeature?.isOrigin && originCells.length > 1);
  return (
    <div className="mt-2 flex w-full flex-col gap-1 font-light">
      <div className="flex w-full flex-row justify-center gap-1">
        <button
          // onClick={handleAddOrigin}
          disabled
          className="pointer-events-auto flex h-11 w-24 flex-col items-center justify-center gap-[2px] rounded-md bg-black px-3 py-1 text-xs uppercase tracking-wider text-white opacity-20 transition active:scale-95 lg:h-fit"
        >
          <PedalBikeRoundedIcon fontSize="small" />
          origin
        </button>
        <button
          onClick={handleRemove}
          className="pointer-events-auto flex h-11 w-24 flex-col items-center justify-center gap-[2px] rounded-md bg-black px-3 py-1 text-xs uppercase tracking-wider text-white shadow-[inset_0_0_0_2px_black,inset_0_0_0_3px_rgb(255,255,255)] transition active:scale-95 lg:h-fit"
        >
          <span className="material-symbols-outlined h-[20px] w-[20px]">
            bike_dock
          </span>
          DEST
        </button>
      </div>
      {multipleCells && (
        <button
          onClick={handleClear}
          className="pointer-events-auto h-11 rounded-md px-3 py-1 text-xs text-red-600 transition hover:bg-cb-white active:scale-95 lg:h-fit"
        >
          Clear {clickedFeature?.isOrigin ? "origin" : "destination"}
        </button>
      )}
    </div>
  );
};

export const SelectionButtons: React.FC<{
  cellId: string;
  clickedFeature: ClickedFeature;
}> = ({ cellId, clickedFeature }) => {
  const {
    addOrRemoveDestinationCell,
    addOrRemoveOriginCell,
    setDestinationCells,
    setOriginCells,
  } = useMapConfigStore();
  const isSelected = clickedFeature?.isDestination || clickedFeature?.isOrigin;

  const handleClear = () => {
    if (clickedFeature?.isDestination) setDestinationCells([]);
    if (clickedFeature?.isOrigin) setOriginCells([]);
    setClickedFeature(null);
  };
  const { setClickedFeature } = usePopupStateStore();

  const handleOriginSelect = () => {
    if (clickedFeature?.isDestination) {
      addOrRemoveDestinationCell(cellId);
    }

    addOrRemoveOriginCell(cellId);
    setClickedFeature(null);
  };
  const handleDestinationSelect = () => {
    if (clickedFeature?.isOrigin) {
      addOrRemoveOriginCell(cellId);
    }
    addOrRemoveDestinationCell(cellId);
    setClickedFeature(null);
  };

  return (
    <div className="mt-2 flex w-full flex-col gap-1 font-light uppercase">
      <div className="flex w-full flex-row justify-center gap-1">
        <button
          onClick={handleOriginSelect}
          className={classNames(
            "pointer-events-auto flex h-11 w-24 flex-col items-center justify-center gap-[2px] rounded-md border-[0.5px] border-cb-lightGray px-3 py-1 text-xs uppercase tracking-wider transition active:scale-95 lg:h-fit",
            clickedFeature?.isOrigin
              ? "bg-cb-white text-cb-blue hover:bg-cb-blue hover:text-cb-white"
              : "bg-cb-blue text-cb-white hover:bg-cb-white hover:text-cb-blue",
            {
              hidden: clickedFeature?.isDestination,
            },
          )}
        >
          {clickedFeature?.isOrigin ? (
            <MinusHexIcon width={24} height={24} />
          ) : (
            <AddHexIcon width={24} height={24} />
          )}
          origin
        </button>
        <button
          onClick={handleDestinationSelect}
          className={classNames(
            "pointer-events-auto flex h-11 w-24 flex-col items-center justify-center gap-[2px] rounded-md border-[0.5px] border-cb-lightGray px-3 py-1 text-xs uppercase tracking-wider text-cb-blue transition hover:text-cb-white active:scale-95 lg:h-fit",
            clickedFeature?.isDestination
              ? "bg-cb-blue/80 text-cb-white hover:bg-cb-blue"
              : "bg-cb-blue text-cb-white hover:bg-cb-white hover:text-cb-blue",

            {
              hidden: clickedFeature?.isOrigin,
            },
          )}
        >
          {clickedFeature?.isDestination ? (
            <MinusHexIcon width={24} height={24} />
          ) : (
            <AddHexIcon width={24} height={24} />
          )}
          DEST
        </button>
      </div>
      {isSelected && (
        <button
          onClick={() => handleClear()}
          className="pointer-events-auto h-11 rounded-md px-3 py-1 text-xs text-cb-blue transition hover:bg-cb-white/20 active:scale-95 lg:h-fit"
        >
          Clear {clickedFeature?.isOrigin ? "origin" : "destination"}
        </button>
      )}
    </div>
  );
};

const ComparisonPopupMetric: React.FC<{
  cellId: string;
  comparisonDate: dayjs.Dayjs | null;
}> = ({ cellId, comparisonDate }) => {
  const comparison = useComparison(false);
  const cellComparison = comparison.getCellComparison(cellId);
  const isPositiveChange = cellComparison
    ? cellComparison.absoluteChange > 0
    : false;

  const hasComparison =
    cellComparison && !comparison.isLoading && cellComparison.previousCount > 0;
  if (comparison.isLoading) {
    return (
      <div className="mt-0.5 flex items-center gap-1 text-xs blur-sm">
        <TrendingUpRoundedIcon fontSize="small" />
        <span className="font-medium tabular-nums">000</span>
        <span>(+0.0%)</span>
      </div>
    );
  }

  if (hasComparison) {
    return (
      <div
        className={`mt-0.5 flex items-center gap-1 text-xs ${
          isPositiveChange ? "text-cb-increase" : "text-cb-decrease"
        }`}
      >
        {isPositiveChange ? (
          <TrendingUpRoundedIcon fontSize="small" />
        ) : (
          <TrendingDownRoundedIcon fontSize="small" />
        )}
        <span className="font-medium tabular-nums">
          {formatter.format(Math.abs(cellComparison.absoluteChange))}
        </span>

        <span>
          ({isPositiveChange ? "+" : ""}
          {cellComparison.percentageChange.toFixed(1)}%)
        </span>
      </div>
    );
  }

  return (
    <div className="mt-0.5 text-xs font-light text-gray-600">
      No data in {comparisonDate?.format("MMM YYYY")}
    </div>
  );
};

const TripCountPopupMetric: React.FC<{
  tripCount: number | undefined;
  loading: boolean;
}> = ({ tripCount, loading }) => {
  return (
    <div className="flex flex-row items-center justify-center gap-1">
      {loading ? (
        <span className="animate-pulse tabular-nums blur-sm">0</span>
      ) : (
        <span className="font-bold tabular-nums tracking-wider">
          {formatter.format(tripCount ?? 0)}{" "}
        </span>
      )}
      <span className="text-xs font-medium uppercase tracking-wide">trips</span>
    </div>
  );
};

const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto absolute right-0 top-0 h-8 w-8 rounded-full text-gray-500 hover:bg-white/30"
    >
      <CloseRoundedIcon fontSize="small" />
    </button>
  );
};
