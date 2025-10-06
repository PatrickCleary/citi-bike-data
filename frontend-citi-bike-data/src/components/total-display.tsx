import { useTripCountData } from "@/map/map-config";
import { useMapConfigStore } from "@/store/store";

import { spanClassName } from "@/map/popup";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";

const getDisplayText = (trips, analysisType, departureCells) => {
  if (!departureCells || departureCells.length === 0) {
    return "Total trips";
  }
  if (departureCells.length >= 1) {
    return `${analysisType === "departures" ? "Trips to" : "Trips from"}`;
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
    <div className="border-cb-white/50 drop-shadow-lg flex flex-col items-end rounded-md border border-gray-300 bg-white/30 px-4 py-2 font-bold tracking-wide text-black backdrop-blur-md">
      {query.isLoading ? (
        <span className="animate-pulse text-xl blur-sm">0</span>
      ) : (
        <p>
          <span className="text-xl tabular-nums">
            {totalTrips.toLocaleString()}
          </span>
        </p>
      )}
      <p className="flex flex-row gap-[2px] font-light uppercase tracking-wider">
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
