import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";

import { PopupContent, spanClassName } from "@/map/popup";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import { MapButton } from "@/map/map-button";

const getDisplayText = (trips, analysisType, departureCells) => {
  if (!departureCells || departureCells.length === 0) {
    return "Total trips";
  }
  if (departureCells.length >= 1) {
    return `${analysisType === "departures" ? "trips to" : "trips from"}`;
  }
};

export const TotalDisplay: React.FC = () => {
  const { analysisType, departureCells, setDepartureCells } =
    useMapConfigStore();
  const query = useTripCountData();
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="flex w-full flex-col items-end rounded-md bg-white/30 px-4 py-2 font-sans font-bold tracking-wide text-black drop-shadow-lg backdrop-blur-md">
      <p className="flex w-full justify-start gap-[2px] rounded-sm font-light uppercase tracking-wider">
        {getDisplayText(totalTrips, analysisType, departureCells)}
        {departureCells.length > 0 && (
          <span className={spanClassName}>
            <span>area</span>
            <HexagonOutlinedIcon fontSize="small" />
          </span>
        )}
      </p>
      <div className="flex w-full flex-row items-start justify-start gap-1 text-left">
        {query.isLoading ? (
          <span className="animate-pulse text-xl blur-sm">0</span>
        ) : (
          <p>
            <span className="text-xl tabular-nums">
              {totalTrips.toLocaleString()}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};
