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
import ArrowCircleRightRoundedIcon from "@mui/icons-material/ArrowCircleRightRounded";
interface PopupProps {
  map: MutableRefObject<Map | null>;
}

export const PopupComponent: React.FC<PopupProps> = ({ map }) => {
  // a ref to hold the popup instance
  const popupRef = useRef<Popup>();
  // a ref for an element to hold the popup's content
  const contentRef = useRef(document.createElement("div"));
  const query = useTripCountData();
  const tripCounts = query.data?.data.trip_counts || {};
  const totalTrips = query.data?.data.sum_all_values || {};
  const { hoveredFeature } = usePopupStateStore();
  const { departureCells, scale } = useMapConfigStore();
  const hoveredFeatureIsInSelection = departureCells.includes(
    hoveredFeature?.id || "",
  );
  const hoveredTripCount =
    tripCounts[hoveredFeature?.id as string] || undefined;
  const hexColor = getHexagonColor(hoveredTripCount, scale);
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
      popupRef.current.remove();
    };
  }, [map.current]);

  // when activeFeature changes, set the popup's location and content, and add it to the map
  useEffect(() => {
    if (!hoveredFeature || !popupRef.current) return;
    if (hoveredTripCount === 0) {
      popupRef.current.remove();
      return;
    }
    popupRef.current
      .setLngLat(hoveredFeature.coordinates) // set its position using activeFeature's geometry
      .setDOMContent(contentRef.current) // use contentRef to set the DOM content of the popup
      .addTo(map.current); // add the popup to the map
  }, [hoveredFeature]);
  // use a react portal to render the content to show in the popup, assigning it to contentRef
  return (
    <>
      {createPortal(
        <PopupContent
          hoveredTripCount={hoveredTripCount}
          totalTrips={totalTrips}
          hoveredFeatureIsInSelection={hoveredFeatureIsInSelection}
          hexColor={hexColor}
        />,
        contentRef.current,
      )}
    </>
  );
};

export default PopupComponent;

export const PopupContent: React.FC<{
  hoveredTripCount: number | undefined;
  totalTrips: number;
  hoveredFeatureIsInSelection: boolean;
  hexColor: string;
}> = ({
  hoveredTripCount,
  totalTrips,
  hoveredFeatureIsInSelection,
  hexColor,
}) => {
  const { analysisType, departureCells } = useMapConfigStore();
  const noCellsSelected = departureCells.length === 0;
  if (noCellsSelected)
    return (
      <PopupDiv>
        <div className="flex flex-row items-center justify-center gap-2">
          <ArrDepIcon analysisType={analysisType} />

          {hoveredTripCount === undefined ? (
            <span className="animate-pulse tabular-nums blur-sm">0 trips</span>
          ) : (
            <span className="tabular-nums">
              {formatter.format(hoveredTripCount)} trips
            </span>
          )}
        </div>
        <p className="flex flex-row items-center gap-1 text-center text-xs font-light">
          {analysisType === "arrivals" ? "Arriving to" : "Departing from"}
          <span className={spanClassName}>
            <HexagonIcon
              fontSize="small"
              style={{
                color: hexColor,
              }}
            />
            Cell
          </span>
        </p>
      </PopupDiv>
    );

  return (
    <PopupDiv>
      <div className="flex flex-row items-center justify-center gap-2">
        <ArrDepIcon analysisType={analysisType} />
        <span className="tabular-nums">
          {hoveredTripCount === undefined ? (
            <span className="animate-pulse blur-sm">000 trips</span>
          ) : (
            <span>{formatter.format(hoveredTripCount)} trips</span>
          )}{" "}
        </span>
      </div>
      <ArrDepText analysisType={analysisType} hexColor={hexColor} />
    </PopupDiv>
  );
};

const PopupDiv: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="border-color-white/50 rounded-2 pointer-events-none flex flex-col items-center rounded-md border-[.5px] bg-white/30 px-2 py-1 text-center text-lg font-bold tabular-nums text-black text-neutral-800 backdrop-blur-md">
      {children}
    </div>
  );
};

const spanClassName =
  "bg-cb-lightGray/50 flex flex-row items-center rounded-sm px-1 flex flex-row gap-[2px]";
const ArrDepText: React.FC<{
  analysisType: "arrivals" | "departures";
  hexColor: string;
}> = ({ analysisType, hexColor = "#cccccc" }) => {
  if (analysisType === "arrivals") {
    return (
      <p className="text-xs font-light">
        <span className="flex flex-row items-center gap-1">
          From
          <span className={spanClassName}>
            <HexagonOutlinedIcon fontSize="small" /> Selection{" "}
          </span>
          to
          <span className={spanClassName}>
            <HexagonIcon
              fontSize="small"
              style={{
                color: hexColor,
              }}
            />
            Cell
          </span>
        </span>
      </p>
    );
  } else {
    return (
      <p className="text-xs font-light">
        <span className="flex flex-row items-center gap-1">
          From
          <span className="bg-cb-lightGray/50 flex flex-row items-center space-x-1 rounded-sm px-1">
            <HexagonIcon
              fontSize="small"
              style={{
                color: hexColor,
              }}
            />
            Cell
          </span>
          to
          <span className={spanClassName}>
            <HexagonOutlinedIcon fontSize="small" /> Selection{" "}
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
    return "#F2F3F0"; // transparent for undefined trip counts
  }

  // Return transparent for values outside the scale
  if (tripCount < minScale || minScale >= maxScale) {
    return "#ffffff00";
  }

  const middleValue = (minScale + maxScale) / 2;

  // Color stops
  const colors = {
    low: "#1a2a6c", // blue
    mid: "#b21f1f", // red
    high: "#fdbb2d", // yellow
  };

  // Interpolate between colors based on trip count
  if (tripCount <= middleValue) {
    // Interpolate between low and mid
    const t = (tripCount - minScale) / (middleValue - minScale);
    return interpolateColor(colors.low, colors.mid, t);
  } else {
    // Interpolate between mid and high
    const t = (tripCount - middleValue) / (maxScale - middleValue);
    return interpolateColor(colors.mid, colors.high, t);
  }
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
