import { MutableRefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import maplibregl, { Map, Popup } from "maplibre-gl";
import { usePopupStateStore } from "@/store/popup-store";
import { useTripCountData } from "./map-config";
import { formatter } from "@/utils/utils";
import { useMapConfigStore } from "@/store/store";

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
  const { departureCells } = useMapConfigStore();
  const hoveredFeatureIsInSelection = departureCells.includes(
    hoveredFeature?.id || "",
  );
  const hoveredTripCount = tripCounts[hoveredFeature?.id as string] || 0;

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
        />,
        contentRef.current,
      )}
    </>
  );
};

export default PopupComponent;

export const PopupContent: React.FC<{
  hoveredTripCount: number;
  totalTrips: number;
  hoveredFeatureIsInSelection: boolean;
}> = ({ hoveredTripCount, totalTrips, hoveredFeatureIsInSelection }) => {
  const { analysisType } = useMapConfigStore();
  return (
    <div className="border-color-white/50 rounded-2 pointer-events-none rounded-md border-[.5px] bg-white/30 px-2 py-1 text-center text-lg font-bold tabular-nums text-black text-neutral-800 backdrop-blur-md">
      <span className="font-mono">
        {formatter.format(hoveredTripCount)} trips
      </span>
      <p className="text-xs italic">
        {analysisType === "arrivals"
          ? "From this cell to selection"
          : "From selection to this cell"}
      </p>
      <p className="text-xs italic">
        {hoveredFeatureIsInSelection ? "(in selection)" : ""}
      </p>
      {/* <p>{formatter.format((100 * hoveredTripCount) / totalTrips)}</p> */}
    </div>
  );
};
