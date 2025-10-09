"use client";
import { MutableRefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import maplibregl, { Map, Popup } from "maplibre-gl";
import { usePopupStateStore } from "@/store/popup-store";
import { useTripCountData } from "./map-config";
import { formatter } from "@/utils/utils";
import { useMapConfigStore } from "@/store/store";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import PedalBikeRoundedIcon from "@mui/icons-material/PedalBikeRounded";
import HexagonIcon from "@mui/icons-material/Hexagon";
import { useInteractionModeStore } from "@/store/interaction-mode-store";
interface PopupProps {
  map: MutableRefObject<Map | null>;
}

export const PopupComponent: React.FC<PopupProps> = ({ map }) => {
  // a ref to hold the popup instance
  const popupRef = useRef<Popup>();
  // a ref for an element to hold the popup's content
  const contentRef = useRef<HTMLDivElement | null>(null);
  const query = useTripCountData();
  const tripCounts = query.data?.data.trip_counts || {};
  const { hoveredFeature, setHoveredFeature } = usePopupStateStore();
  const { scale } = useMapConfigStore();
  const { mode } = useInteractionModeStore();
  const loading = query.isLoading;
  const hoveredTripCount = tripCounts[hoveredFeature?.id as string] || 0;
  const hexColor = getHexagonColor(hoveredTripCount, scale);

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
      offset: 10,
      // anchor: "top",
      closeButton: false,
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
    };
  }, [map.current]);

  // Clear popup when switching to selection mode
  useEffect(() => {
    if (mode === "selection") {
      popupRef.current?.remove();
      setHoveredFeature(null);
    }
  }, [mode, setHoveredFeature]);

  // when activeFeature changes, set the popup's location and content, and add it to the map
  useEffect(() => {
    if (!popupRef.current || !map.current) return;

    if (!hoveredFeature) {
      popupRef.current.remove();
      return;
    }

    if (hoveredTripCount === 0) {
      popupRef.current.remove();
      return;
    }
    if (!contentRef.current) return;
    popupRef.current
      .setLngLat(hoveredFeature.coordinates) // set its position using activeFeature's geometry
      .setDOMContent(contentRef.current) // use contentRef to set the DOM content of the popup
      .addTo(map.current); // add the popup to the map
  }, [hoveredFeature]);
  // use a react portal to render the content to show in the popup, assigning it to contentRef
  return (
    <>
      {contentRef.current &&
        createPortal(
          <PopupContent
            hoveredTripCount={hoveredTripCount}
            loading={loading}
            hexColor={hexColor}
            id={hoveredFeature?.id as string}
          />,
          contentRef.current,
        )}
    </>
  );
};

export default PopupComponent;

export const PopupContent: React.FC<{
  loading: boolean;
  hoveredTripCount: number;
  hexColor: string;
  id: string;
}> = ({ loading, hoveredTripCount, hexColor, id }) => {
  const { analysisType, departureCells } = useMapConfigStore();
  const noCellsSelected = departureCells.length === 0;
  if (noCellsSelected)
    return (
      <PopupDiv>
        <div className="flex flex-row items-center justify-center gap-2 font-sans">
          <ArrDepIcon analysisType={analysisType} />
          <p>{id}</p>
          <div className="flex flex-row items-center justify-center gap-1">
            {loading ? (
              <span className="animate-pulse tabular-nums blur-sm">0</span>
            ) : (
              <span className="font-bold tabular-nums tracking-wider">
                {formatter.format(hoveredTripCount)}{" "}
              </span>
            )}
            <span className="text-xs font-medium uppercase tracking-wide">
              trips
            </span>
          </div>
        </div>
        <p className="flex flex-row items-center gap-1 text-center text-xs font-light uppercase tracking-wide">
          {analysisType === "arrivals" ? "arrived here" : "began from"}
          <span className={spanClassName}>
            <HexagonIcon
              fontSize="small"
              style={{
                color: hexColor,
              }}
            />
          </span>
        </p>
      </PopupDiv>
    );

  return (
    <PopupDiv>
      <p>{id}</p>
      <div className="flex flex-row items-center justify-center gap-2 font-sans">
        <ArrDepIcon analysisType={analysisType} />
        <div className="flex flex-row items-center gap-1">
          <span className="font-bold tabular-nums tracking-wider">
            {loading ? (
              <span className="animate-pulse blur-sm">000</span>
            ) : (
              <span>{formatter.format(hoveredTripCount)}</span>
            )}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide">
            Trips
          </span>
        </div>
      </div>
      <ArrDepText analysisType={analysisType} hexColor={hexColor} />
    </PopupDiv>
  );
};

const PopupDiv: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="border-cb-white/50 rounded-2 pointer-events-none flex flex-col items-center rounded-md border-[.5px] bg-white/30 px-2 py-1 text-center font-sans text-lg tabular-nums text-black text-neutral-800 drop-shadow-md backdrop-blur-md">
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
          <span className={spanClassName}>
            <HexagonOutlinedIcon fontSize="small" />
          </span>
          to
          <span className={spanClassName}>
            <HexagonIcon
              fontSize="small"
              style={{
                color: hexColor,
              }}
            />
          </span>
        </span>
      </p>
    );
  } else {
    return (
      <p className="text-xs font-light uppercase">
        <span className="flex flex-row items-center gap-1">
          From
          <span className="bg-cb-lightGray/50 flex flex-row items-center space-x-1 rounded-sm px-1">
            <HexagonIcon
              fontSize="small"
              style={{
                color: hexColor,
              }}
            />
          </span>
          to
          <span className={spanClassName}>
            <HexagonOutlinedIcon fontSize="small" />
          </span>
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
// Helper function to calculate hexagon color based on trip count and scale
const getHexagonColor = (
  tripCount: number | undefined,
  scale: [number, number],
): string => {
  const [minScale, maxScale] = scale;
  if (tripCount === undefined) {
    return "#F2F3F0"; // default color for undefined trip counts
  }

  // Return transparent for values outside the scale
  if (tripCount < minScale || minScale >= maxScale) {
    return "#ffffff00";
  }

  // Apply logarithmic transformation
  const logMin = Math.log(minScale + 1);
  const logMax = Math.log(maxScale + 1);
  const logValue = Math.log(tripCount + 1);
  const logRange = logMax - logMin;

  // Color stops with viridis palette (7 stops for smooth gradients)
  const colorStops: Array<{ position: number; color: string }> = [
    { position: 0, color: "#440154" }, // 0% - dark purple
    { position: 0.15, color: "#482878" }, // 15% - purple
    { position: 0.3, color: "#3e4989" }, // 30% - blue-purple
    { position: 0.45, color: "#31688e" }, // 45% - blue
    { position: 0.6, color: "#26828e" }, // 60% - teal
    { position: 0.75, color: "#35b779" }, // 75% - green
    { position: 0.9, color: "#6ece58" }, // 90% - light green
    { position: 1, color: "#fde725" }, // 100% - yellow
  ];

  // Calculate normalized position in log space (0 to 1)
  const normalizedPosition = (logValue - logMin) / logRange;

  // Clamp to [0, 1]
  const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));

  // Find the two color stops to interpolate between
  let lowerStop = colorStops[0];
  let upperStop = colorStops[colorStops.length - 1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (
      clampedPosition >= colorStops[i].position &&
      clampedPosition <= colorStops[i + 1].position
    ) {
      lowerStop = colorStops[i];
      upperStop = colorStops[i + 1];
      break;
    }
  }

  // Calculate interpolation factor between the two stops
  const t =
    (clampedPosition - lowerStop.position) /
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
