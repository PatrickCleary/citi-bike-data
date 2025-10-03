import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import { spanClassName } from "@/map/popup";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";

const getDisplayText = (trips, analysisType, departureCells) => {
  if (!departureCells || departureCells.length === 0) {
    return "Total trips";
  }
  if (departureCells.length >= 1) {
    return `${analysisType === "departures" ? "Trips ended in" : "Trips began from"}`;
  }
};

export const TotalDisplay: React.FC = () => {
  const {
    analysisType,
    departureCells,
    swapAnalysisType,
    setDepartureCells,
    selectedMonth,
  } = useMapConfigStore();
  const query = useTripCountData();
  const totalTrips = query.data?.data.sum_all_values || 0;

  return (
    <div className="border-color-white/50 flex flex-col items-end rounded-md border border-gray-300 bg-white/30 px-4 py-2 font-bold text-black backdrop-blur-md">
      {query.isLoading ? (
        <span className="animate-pulse text-xl blur-sm">0</span>
      ) : (
        <p>
          <span className="text-xl tabular-nums">
            {totalTrips.toLocaleString()}
          </span>
        </p>
      )}
      <p className="flex flex-row gap-[2px] font-light">
        {getDisplayText(totalTrips, analysisType, departureCells)}
        {departureCells.length > 0 && (
          <span className={spanClassName}>
            <HexagonOutlinedIcon fontSize="small" /> Selection{" "}
          </span>
        )}
      </p>
    </div>
  );
};
